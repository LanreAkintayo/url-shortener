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
          console.error(
            `[Worker] Malformed message in ${queueName}. Dropping.`,
          );
          channel!.ack(msg);
        }
      });

      console.log(`[Worker] Actively monitoring ${queueName}...`);
    }

    flushTimer = setInterval(() => {
      for (const shardId of TARGET_SHARDS) {
        flushShard(shardId);
      }
    }, FLUSH_INTERVAL);

    process.on("SIGTERM", handleGracefulShutdown);
    process.on("SIGINT", handleGracefulShutdown);
  } catch (error) {
    console.error("[Worker] Initialization failed:", error);
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
    console.log(
      `[Worker] Flushed ${currentBatch.length} records to Shard ${shardId}.`,
    );
  } catch (error) {
    console.error(
      `[Worker] Batch insert failed for Shard ${shardId}. Requeueing in ${REQUEUE_DELAY / 1000}s...`,
      error,
    );

    setTimeout(() => {
      if (channel) {
        currentBatch.forEach((item) => channel!.nack(item.msg, false, true));
      } else {
        console.warn(
          `[Worker] Channel unavailable. RabbitMQ will requeue Shard ${shardId} automatically.`,
        );
      }
    }, REQUEUE_DELAY);
  } finally {
    flushingState.set(shardId, false);
  }
};

const handleGracefulShutdown = async (): Promise<void> => {
  console.log(
    "\n[Worker] Shutdown signal received. Flushing memory to databases...",
  );

  if (flushTimer) clearInterval(flushTimer);

  const flushPromises = TARGET_SHARDS.map((id) => flushShard(id));
  await Promise.all(flushPromises);

  console.log("[Worker] Memory flushed. Exiting process safely.");
  process.exit(0);
};

if (require.main === module) {
  startAnalyticsWorker().catch((error) => {
    console.error("[Worker] Failed to start analytics worker:", error);
    process.exit(1);
  });
}

// import amqp from "amqplib";
// import { connectRabbitMQ } from "../config/rabbitmq";
// import * as analyticsService from "../services/analytics.service";

// interface AnalyticsPayload {
//   shortCode: string;
//   ipAddress: string;
//   userAgent: string;
//   referrer: string;
//   timestamp?: string;
// }

// interface BatchItem {
//   payload: AnalyticsPayload;
//   msg: amqp.Message;
// }

// const BATCH_SIZE = 100;
// const FLUSH_INTERVAL = 5000;
// const REQUEUE_DELAY = 5000;

// let batch: BatchItem[] = [];
// let flushTimer: NodeJS.Timeout | null = null;
// let isFlushing = false;
// let channel: Awaited<ReturnType<typeof connectRabbitMQ>> | null = null;

// export const startAnalyticsWorker = async (): Promise<void> => {
//   try {
//     channel = await connectRabbitMQ();
//     await channel.prefetch(BATCH_SIZE * 2); // Pre-fetch 2x the batch size to the RAM of the worker to ensure we have enough messages for processing without overwhelming memory.

//     channel.consume("analytics_queue", (msg) => {
//       if (!msg) return;

//       // console.log("Message received in worker:", msg);

//       try {
//         const payload: AnalyticsPayload = JSON.parse(msg.content.toString());
//         batch.push({ payload, msg });

//         if (batch.length >= BATCH_SIZE) {
//           flushBatch();
//         }
//       } catch (parseError) {
//         console.error("[Worker] Malformed message detected. Dropping payload.");
//         channel!.ack(msg);
//       }
//     });

//     flushTimer = setInterval(flushBatch, FLUSH_INTERVAL);

//     console.log("[Worker] Analytics worker actively consuming events...");

//     // Listen to OS termination signals for graceful shutdown
//     process.on("SIGTERM", handleGracefulShutdown);
//     process.on("SIGINT", handleGracefulShutdown);
//   } catch (error) {
//     console.error("[Worker] Initialization failed:", error);
//     process.exit(1);
//   }
// };

// const flushBatch = async (): Promise<void> => {
//   if (batch.length === 0 || isFlushing) return;

//   isFlushing = true;

//   const currentBatch = [...batch];
//   batch = [];

//   try {
//     const shortCodes = currentBatch.map((b) => b.payload.shortCode);
//     const ipAddresses = currentBatch.map((b) => b.payload.ipAddress);
//     const userAgents = currentBatch.map((b) => b.payload.userAgent);
//     const referrers = currentBatch.map((b) => b.payload.referrer);
//     const timestamps = currentBatch.map(
//       (b) => b.payload.timestamp || new Date().toISOString(),
//     );

//     await analyticsService.logBatchAnalytics({
//       shortCodes,
//       ipAddresses,
//       userAgents,
//       referrers,
//       timestamps,
//     });

//     currentBatch.forEach((item) => channel!.ack(item.msg));

//     console.log(`[Worker] Flushed ${currentBatch.length} records to database.`);
//   } catch (error) {
//     console.error(
//       `[Worker] Batch insert failed for ${currentBatch.length} records. Requeueing in ${REQUEUE_DELAY / 1000}s...`,
//       error,
//     );

//     setTimeout(() => {
//       if (channel) {
//         currentBatch.forEach((item) => channel!.nack(item.msg, false, true));
//       } else {
//         console.warn(
//           `[Worker] Channel unavailable during requeue. RabbitMQ will requeue ${currentBatch.length} unacked messages automatically on reconnect.`,
//         );
//       }
//     }, REQUEUE_DELAY);
//   } finally {
//     isFlushing = false;
//   }
// };

// const handleGracefulShutdown = async (): Promise<void> => {
//   console.log(
//     "\n[Worker] Shutdown signal received. Flushing memory to database...",
//   );

//   if (flushTimer) clearInterval(flushTimer);

//   await flushBatch();

//   console.log("[Worker] Memory flushed. Exiting process safely.");
//   process.exit(0);
// };

// if (require.main === module) {
//   startAnalyticsWorker().catch((error) => {
//     console.error("[Worker] Failed to start analytics worker:", error);
//     process.exit(1);
//   });
// }
