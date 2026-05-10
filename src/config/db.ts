import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import dotenv from "dotenv";
import Hashids from "hashids";

dotenv.config();

const SECRET_SALT = process.env.HASHIDS_SALT || "lanre_default_salt";
const hashids = new Hashids(SECRET_SALT, 6);

const poolNode1 = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

// In production, read will be a replica_database and write to poolNode1
export const dbNode1 = {
  write: drizzle(poolNode1, { schema }),
  read: drizzle(poolNode1, { schema }),
};

const poolNode2 = new Pool({
  connectionString: process.env.NODE2_DATABASE_URL,
  max: 20,
});

export const dbNode2 = {
  write: drizzle(poolNode2, { schema }),
  read: drizzle(poolNode2, { schema }),
};

poolNode1.on("connect", () =>
  console.log("[Shard 1] DB connection established"),
);
poolNode2.on("connect", () =>
  console.log("[Shard 2] DB connection established"),
);

poolNode1.on("error", (err) => {
  console.error(`[Shard 1] Connection error:`, err);
  process.exit(-1);
});

poolNode2.on("error", (err) => {
  console.error(`[Shard 2] Connection error:`, err);
  process.exit(-1);
});

export const getShardId = (shortCode: string): number => {
  const decoded = hashids.decode(shortCode);

  if (!decoded || decoded.length === 0) {
    console.warn(`[Router] Invalid code ${shortCode}. Defaulting to Shard 1.`);
    return 1;
  }

  const explicitlySavedShardId = Number(decoded[1]);
  return explicitlySavedShardId || 1;
};

export const getDbByShardId = (shardId: number) => {
  return shardId === 2 ? dbNode2 : dbNode1;
};

export const getDbShard = (shortCode: string) => {
  const shardId = getShardId(shortCode);
  return getDbByShardId(shardId);
};
