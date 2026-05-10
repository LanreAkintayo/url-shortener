import { keyPool, kgsState } from "../db/schema";
import { sql } from "drizzle-orm";
import Hashids from "hashids";
import { dbNode1 } from "../config/db";

const POOL_MIN_SIZE = 10;
const POOL_MAX_SIZE = 50;
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
    console.error("[KGS] Failed to initialize state: ", error);
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
    console.log("[KGS] Current pool size::", currentSize);
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
    console.log(
      `[KGS] Generated ${countToGenerate} new keys across ${TOTAL_SHARDS} shards. Pool replenished.`,
    );
  } catch (error) {
    console.error("[KGS] Error during pool check: ", error);
  }
};

export const startKGSWorker = async (): Promise<void> => {
  console.log("[KGS] Worker starting...");

  await initKgsState();
  console.log("[KGS] State initialized.");

  await refillPool();
  console.log("[KGS] Pool refilled.");
  setInterval(refillPool, CHECK_INTERVAL_MS);
};

if (require.main === module) {
  startKGSWorker().catch((error) => {
    console.error("[KGS] Worker failed to start:", error);
    process.exit(1);
  });
}
