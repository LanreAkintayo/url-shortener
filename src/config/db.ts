import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import dotenv from "dotenv";
import Hashids from "hashids";
import { logger } from "../utils/logger";

dotenv.config();

const SECRET_SALT = process.env.HASHIDS_SALT || "lanre_default_salt";
const hashids = new Hashids(SECRET_SALT, 6);

/**
 * Initializes a database shard connection with read-write splitting.
 * Defaults to the primary connection for read operations if a replica URL is not provided.
 */
const createShardConnection = (
  shardId: number,
  writeConnectionString?: string | null,
  readConnectionString?: string | null,
) => {
  if (!writeConnectionString) {
    logger.fatal(
      { shardId, service: "db" },
      "Missing primary database connection string",
    );
    process.exit(1);
  }

  const writePool = new Pool({
    connectionString: writeConnectionString,
    max: 20,
  });

  writePool.on("connect", () =>
    logger.info(
      { shardId, nodeType: "primary", service: "db" },
      "Primary DB connection established",
    ),
  );

  writePool.on("error", (err) => {
    logger.fatal(
      { err, shardId, nodeType: "primary", service: "db" },
      "Primary DB connection error",
    );
    process.exit(-1);
  });

  let readPool = writePool;

  if (readConnectionString?.trim()) {
    readPool = new Pool({ connectionString: readConnectionString, max: 20 });

    readPool.on("connect", () =>
      logger.info(
        { shardId, nodeType: "replica", service: "db" },
        "Replica DB connection established",
      ),
    );

    readPool.on("error", (err) => {
      logger.error(
        { err, shardId, nodeType: "replica", service: "db" },
        "Replica DB connection error",
      );
    });
  }

  return {
    write: drizzle(writePool, { schema }),
    read: drizzle(readPool, { schema }),
  };
};

export const dbNode1 = createShardConnection(1, process.env.DATABASE_URL, null);

export const dbNode2 = createShardConnection(
  2,
  process.env.NODE2_DATABASE_URL,
  null,
);

const shardMap = new Map([
  [1, dbNode1],
  [2, dbNode2],
]);

export const getShardId = (shortCode: string): number => {
  const decoded = hashids.decode(shortCode);

  logger.debug({ shortCode, decoded, service: "db" }, "Decoding short code");

  if (!decoded || decoded.length === 0) {
    logger.warn(
      { shortCode, service: "db" },
      "Invalid code. Defaulting to Shard 1.",
    );
    return 1;
  }

  const explicitlySavedShardId = Number(decoded[1]);
  return explicitlySavedShardId || 1;
};

export const getDbByShardId = (shardId: number) => {
  const db = shardMap.get(shardId);

  if (!db) {
    logger.error(
      { shardId, service: "db" },
      "Requested shard does not exist. Defaulting to Shard 1.",
    );
    return dbNode1;
  }

  return db;
};

export const getDbShard = (shortCode: string) => {
  const shardId = getShardId(shortCode);
  logger.debug(
    { shortCode, shardId, service: "db" },
    "Routing to database shard",
  );
  return getDbByShardId(shardId);
};
