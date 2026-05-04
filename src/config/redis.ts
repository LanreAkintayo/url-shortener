import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  console.error("[Redis] Redis Client Error", err);
});

redisClient.on("connect", () => {
  console.log("[Redis] Connected to Redis");
});

export const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    console.error("[Redis] Failed to connect to Redis", error);
    process.exit(1);
  }
};

export default redisClient;
