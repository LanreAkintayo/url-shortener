import { pool } from "../config/db";
import { nanoid } from "nanoid";

const POOL_MIN_SIZE = 10;
const POOL_MAX_SIZE = 50;
const CHECK_INTERVAL_MS = 60000; // Check every 60 seconds

const getPoolSize = async (): Promise<number> => {
  const query = `SELECT COUNT(*) FROM key_pool`;
  const result = await pool.query(query);

  return parseInt(result.rows[0].count, 10);
};

const generateKeys = async (count: number): Promise<void> => {
  const keys = Array.from({ length: count }, () => nanoid(8));

  const placeholders = keys.map((_, index) => `($${index + 1})`).join(", ");

  const query = `
    INSERT INTO key_pool (short_code) VALUES ${placeholders}
    ON CONFLICT (short_code) DO NOTHING;
    `;
  await pool.query(query, keys);

  console.log("[KGS] Generated ", count, " new keys. Pool replenished.");
};

const refillPool = async () => {
  try {
    const currentSize = await getPoolSize();
    if (currentSize < POOL_MIN_SIZE) {
      // Determine the number of keys to generate
      const count = POOL_MAX_SIZE - currentSize;

      console.log("[KGS] Pool size is low. Generating ", count, " new keys...");

      await generateKeys(count);
    } else {
      console.log(
        `[KGS] Pool is healthy at ${currentSize} keys. No need to generate new keys.`,
      );
    }
  } catch (error) {
    console.error(`[KGS] Error during pool check: `, error);
  }
};

export const getKeyFromPool = async (): Promise<string> => {
  const query = `
    DELETE FROM key_pool
    WHERE id = (
        SELECT id FROM key_pool
        ORDER BY id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING short_code
    `;

  const result = await pool.query(query);
  if (result.rows.length == 0) {
    console.warn("[KGS] Pool is empty, generating key on the fly");
    return nanoid(8);
  }

  return result.rows[0].short_code;
};

export const startKGSWorker = async (): Promise<void> => {
  console.log("[KGS] Worker started.");

  // Initial pool check and generation
  await refillPool();

  setInterval(refillPool, CHECK_INTERVAL_MS);
};


// Entry point only when run as standalone worker
if (require.main === module) {
    startKGSWorker().catch((error) => {
        console.error('[KGS] Worker failed to start:', error);
        process.exit(1);
    });
}
