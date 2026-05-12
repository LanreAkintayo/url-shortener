import amqp from "amqplib";
import { connectRabbitMQ } from "../config/rabbitmq";
import * as analyticsService from "../services/analytics.service";
import { logger } from "../utils/logger";

interface AnalyticsPayload {
  shortCode: string;
  ipAddress: string;
  userAgent: string;
  referrer: string;
  timestamp?: string;
}

interface BatchItem {
  payload: AnalyticsPayload;
  msg: amqp.Message;
}

const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 5000;
const REQUEUE_DELAY = 5000;

// Read which queues this worker should monitor (Defaults to Shard 1 and 2)
const TARGET_SHARDS = (process.env.SHARD_QUEUES || "1,2")
  .split(",")
  .map(Number);

const shardBuckets = new Map<number, BatchItem[]>();
const flushingState = new Map<number, boolean>();

let flushTimer: NodeJS.Timeout | null = null;
let channel: Awaited<ReturnType<typeof connectRabbitMQ>> | null = null;

export const startAnalyticsWorker = async (): Promise<void> => {
  try {
    channel = await connectRabbitMQ();
    // Pre-fetch enough messages for all the queues we are monitoring
    await channel.prefetch(BATCH_SIZE * 2);

    for (const shardId of TARGET_SHARDS) {
      shardBuckets.set(shardId, []);
      flushingState.set(shardId, false);

      const queueName = `analytics_queue_${shardId}`;
      await channel.assertQueue(queueName, { durable: true });

      channel.consume(queueName, (msg) => {
        if (!msg) return;

        try {
          const payload: AnalyticsPayload = JSON.parse(msg.content.toString());
          const bucket = shardBuckets.get(shardId)!;

          bucket.push({ payload, msg });

          if (bucket.length >= BATCH_SIZE) {
            flushShard(shardId);
          }
        } catch (parseError) {
          logger.warn(
            { err: parseError, queueName, service: "analytics_worker" },
            "Malformed message in queue. Dropping.",
          );

          channel!.ack(msg);
        }
      });

      logger.info(
        {
          queueName,
          service: "analytics_worker",
        },
        "Actively monitoring queue",
      );
    }

    flushTimer = setInterval(() => {
      for (const shardId of TARGET_SHARDS) {
        flushShard(shardId);
      }
    }, FLUSH_INTERVAL);

    process.on("SIGTERM", handleGracefulShutdown);
    process.on("SIGINT", handleGracefulShutdown);
  } catch (error) {
    logger.fatal(
      { err: error, service: "analytics_worker" },
      "Worker failed to start",
    );
    process.exit(1);
  }
};

const flushShard = async (shardId: number): Promise<void> => {
  const bucket = shardBuckets.get(shardId)!;

  if (bucket.length === 0 || flushingState.get(shardId)) return;

  flushingState.set(shardId, true);

  const currentBatch = [...bucket];
  shardBuckets.set(shardId, []);

  try {
    const analyticsPayload = currentBatch.map((b) => ({
      shortCode: b.payload.shortCode,
      ipAddress: b.payload.ipAddress,
      userAgent: b.payload.userAgent,
      referrer: b.payload.referrer,
      createdAt: b.payload.timestamp || new Date().toISOString(),
    }));

    // Pass the shardId to the service so it knows which database to write to
    await analyticsService.logBatchAnalytics(shardId, analyticsPayload);

    currentBatch.forEach((item) => channel!.ack(item.msg));
    logger.info(
      {
        shardId,
        recordCount: currentBatch.length,
        service: "analytics_worker",
      },
      "Flushed recods to Batch",
    );
  } catch (error) {
    logger.error(
      {
        err: error,
        shardId,
        delayMs: REQUEUE_DELAY,
        service: "analytics_worker",
      },
      "Batch insert failed. Requeueing messages",
    );

    setTimeout(() => {
      if (channel) {
        currentBatch.forEach((item) => channel!.nack(item.msg, false, true));
      } else {
        logger.warn(
          { shardId, service: "analytics_worker" },
          "Channel unavailable. RabbitMQ will requeue automatically",
        );
      }
    }, REQUEUE_DELAY);
  } finally {
    flushingState.set(shardId, false);
  }
};

const handleGracefulShutdown = async (): Promise<void> => {
  logger.info(
    { service: "analytics_worker" },
    "Shutdown signal received. Flushing memory to databases",
  );

  if (flushTimer) clearInterval(flushTimer);

  const flushPromises = TARGET_SHARDS.map((id) => flushShard(id));
  await Promise.all(flushPromises);

  logger.info(
    { service: "analytics_worker" },
    "Memory flushed. Exiting process safely",
  );
  process.exit(0);
};

if (require.main === module) {
  startAnalyticsWorker().catch((error) => {
    logger.fatal(
      { err: error, service: "analytics_worker" },
      "Failed to start analytics worker",
    );
    process.exit(1);
  });
}
