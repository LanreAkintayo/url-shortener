import amqp from "amqplib";
import { connectRabbitMQ } from "../config/rabbitmq";
import * as analyticsService from "../services/analytics.service";

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

let batch: BatchItem[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let isFlushing = false;
let channel: Awaited<ReturnType<typeof connectRabbitMQ>> | null = null;

export const startAnalyticsWorker = async (): Promise<void> => {
  try {
    channel = await connectRabbitMQ();
    await channel.prefetch(BATCH_SIZE * 2); // Pre-fetch 2x the batch size to the RAM of the worker to ensure we have enough messages for processing without overwhelming memory.

    channel.consume("analytics_queue", (msg) => {
      if (!msg) return;

      console.log("Message received in worker:", msg);

      try {
        const payload: AnalyticsPayload = JSON.parse(msg.content.toString());
        batch.push({ payload, msg });

        if (batch.length >= BATCH_SIZE) {
          flushBatch();
        }
      } catch (parseError) {
        console.error("[Worker] Malformed message detected. Dropping payload.");
        channel!.ack(msg);
      }
    });

    flushTimer = setInterval(flushBatch, FLUSH_INTERVAL);

    console.log("[Worker] Analytics worker actively consuming events...");

    // Listen to OS termination signals for graceful shutdown
    process.on("SIGTERM", handleGracefulShutdown);
    process.on("SIGINT", handleGracefulShutdown);
  } catch (error) {
    console.error("[Worker] Initialization failed:", error);
    process.exit(1);
  }
};

const flushBatch = async (): Promise<void> => {
  if (batch.length === 0 || isFlushing) return;

  isFlushing = true;

  const currentBatch = [...batch];
  batch = [];

  try {
    const shortCodes = currentBatch.map((b) => b.payload.shortCode);
    const ipAddresses = currentBatch.map((b) => b.payload.ipAddress);
    const userAgents = currentBatch.map((b) => b.payload.userAgent);
    const referrers = currentBatch.map((b) => b.payload.referrer);
    const timestamps = currentBatch.map(
      (b) => b.payload.timestamp || new Date().toISOString(),
    );

    await analyticsService.logBatchAnalytics({
      shortCodes,
      ipAddresses,
      userAgents,
      referrers,
      timestamps,
    });

    currentBatch.forEach((item) => channel!.ack(item.msg));

    console.log(`[Worker] Flushed ${currentBatch.length} records to database.`);
  } catch (error) {
    console.error(
      `[Worker] Batch insert failed for ${currentBatch.length} records. Requeueing in ${REQUEUE_DELAY / 1000}s...`,
      error,
    );

    setTimeout(() => {
      if (channel) {
        currentBatch.forEach((item) => channel!.nack(item.msg, false, true));
      } else {
        console.warn(
          `[Worker] Channel unavailable during requeue. RabbitMQ will requeue ${currentBatch.length} unacked messages automatically on reconnect.`,
        );
      }
    }, REQUEUE_DELAY);
  } finally {
    isFlushing = false;
  }
};

const handleGracefulShutdown = async (): Promise<void> => {
  console.log(
    "\n[Worker] Shutdown signal received. Flushing memory to database...",
  );

  if (flushTimer) clearInterval(flushTimer);

  await flushBatch();

  console.log("[Worker] Memory flushed. Exiting process safely.");
  process.exit(0);
};


if (require.main === module) {
  startAnalyticsWorker().catch((error) => {
    console.error("[Worker] Failed to start analytics worker:", error);
    process.exit(1);
  });
}