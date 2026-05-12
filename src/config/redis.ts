import { createClient } from "redis";
import dotenv from "dotenv";
import { logger } from "../utils/logger";

dotenv.config();

const REDIS_URL =
  process.env.NODE_ENV === "production"
    ? process.env.REDIS_URL
    : process.env.REDIS_URL_LOCAL;

const redisClient = createClient({
  url: REDIS_URL,
});

redisClient.on("error", (err) => {
  logger.error({ err, service: "redis" }, "Redis client error");
});

redisClient.on("connect", () => {
  logger.info({ service: "redis" }, "Connected to Redis");
});

/**
 * Establishes a connection to the Redis instance if one is not already open.
 * Terminates the process if the initial connection fails.
 */
export const connectRedis = async (): Promise<void> => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    logger.fatal({ err: error, service: "redis" }, "Failed to connect to Redis");
    process.exit(1);
  }
};

export default redisClient;