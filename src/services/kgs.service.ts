import { dbNode1 } from "../config/db"; 
import { sql } from "drizzle-orm";
import Hashids from "hashids";
import { logger } from "../utils/logger";

const SECRET_SALT = process.env.HASHIDS_SALT || "lanre_default_salt";
const hashids = new Hashids(SECRET_SALT, 6);

/**
 * Retrieves a unique, short code from the centralized global pool.
 */
export const getShortCode = async (): Promise<string> => {
  // Attempt to grab and remove a key from the pool atomically
  const poolQuery = sql`
    DELETE FROM key_pool
    WHERE id = (
      SELECT id FROM key_pool
      ORDER BY id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING short_code
  `;

  // Explicitly routing KGS queries to Node 1's write pool
  const poolResult = await dbNode1.write.execute(poolQuery);

  if (poolResult.rows.length > 0) {
    return poolResult.rows[0].short_code as string;
  }

  // Fallback: If pool is empty, generate one immediately from the global counter.
  logger.warn({ service: "kgs_service" }, "Pool empty. Generating fallback key...");
  
  const fallbackQuery = sql`
    UPDATE kgs_state 
    SET current_counter = current_counter + 1, updated_at = NOW()
    WHERE id = 1 
    RETURNING current_counter
  `;

  const fallbackResult = await dbNode1.write.execute(fallbackQuery);
  const counterValue = Number(fallbackResult.rows[0].current_counter);

  return hashids.encode(counterValue);
};