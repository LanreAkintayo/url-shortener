import { db } from "../config/db";
import { sql } from "drizzle-orm";
import Hashids from "hashids";

const SECRET_SALT = process.env.HASHIDS_SALT || "lanre_default_salt";
const hashids = new Hashids(SECRET_SALT, 6);

/**
 * Retrieves a unique, short code.
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

  const poolResult = await db.execute(poolQuery);

  if (poolResult.rows.length > 0) {
    // console.log("[KGS Service] Pool hit. Remaining keys:",  );
    return poolResult.rows[0].short_code as string;
  }

  // Fallback: If pool is empty, generate one immediately from the global counter
  console.warn("[KGS Service] Pool empty. Generating fallback key...");
  
  const fallbackQuery = sql`
    UPDATE kgs_state 
    SET current_counter = current_counter + 1, updated_at = NOW()
    WHERE id = 1 
    RETURNING current_counter
  `;

  const fallbackResult = await db.execute(fallbackQuery);
  const counterValue = Number(fallbackResult.rows[0].current_counter);

  return hashids.encode(counterValue);
};