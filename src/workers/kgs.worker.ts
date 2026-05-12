import { keyPool, kgsState } from "../db/schema";
import { sql } from "drizzle-orm";
import Hashids from "hashids";
import { dbNode1 } from "../config/db";
import { logger } from "../utils/logger";

const POOL_MIN_SIZE = 1;
const POOL_MAX_SIZE = 5;
const CHECK_INTERVAL_MS = 60000;

const SECRET_SALT = process.env.HASHIDS_SALT || "default_dev_salt";
const hashids = new Hashids(SECRET_SALT, 6);
const TOTAL_SHARDS = Number(process.env.TOTAL_ACTIVE_SHARDS) || 2;

const initKgsState = async () => {
  try {
    await dbNode1.write
      .insert(kgsState)
      .values({
        id: 1,
        currentCounter: 1000000,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  } catch (error) {
    logger.fatal(
      { err: error, service: "kgs_worker" },
      "Failed to initialize state",
    );
    throw error;
  }
};

const getPoolSize = async (): Promise<number> => {
  const result = await dbNode1.write.execute(
    sql`SELECT COUNT(*) as count FROM key_pool`,
  );
  return parseInt(result.rows[0].count as string, 10);
};

const refillPool = async () => {
  try {
    const currentSize = await getPoolSize();
    logger.debug({ currentSize, service: "kgs_worker" }, "Pool size check");
    if (currentSize >= POOL_MIN_SIZE) return;

    const countToGenerate = POOL_MAX_SIZE - currentSize;

    const claimResult = await dbNode1.write.execute(sql`
      UPDATE kgs_state 
      SET 
        current_counter = current_counter + ${countToGenerate},
        updated_at = NOW()
      WHERE id = 1 
      RETURNING current_counter
    `);

    if (claimResult.rows.length === 0) {
      throw new Error("No state record found");
    }

    const newMaxCounter = Number(claimResult.rows[0].current_counter);
    const startingCounter = newMaxCounter - countToGenerate;

    const newKeys = [];
    for (let i = 0; i < countToGenerate; i++) {
      const uniqueNumber = startingCounter + i;

      const targetShardId = (uniqueNumber % TOTAL_SHARDS) + 1;
      newKeys.push({
        shortCode: hashids.encode([uniqueNumber, targetShardId]),
      });
    }

    await dbNode1.write.insert(keyPool).values(newKeys);
    logger.info(
      { countToGenerate, shards: TOTAL_SHARDS, service: "kgs_worker" },
      "Pool replenished",
    );
  } catch (error) {
    logger.error({ err: error, service: "kgs_worker" }, "Pool refill failed");
  }
};

export const startKGSWorker = async (): Promise<void> => {
  logger.info({service: "kgs_worker"}, "Worker starting..")
  
  await initKgsState();
  
  logger.info({service: "kgs_worker"}, "State Initialized")

  await refillPool();

  logger.info({service: "kgs_worker"}, "Pool refilled")

  setInterval(refillPool, CHECK_INTERVAL_MS);
};

if (require.main === module) {
  startKGSWorker().catch((error) => {
    logger.fatal({ err: error, service: "kgs_worker" }, "Worker failed to start");
    process.exit(1);
  });
}
