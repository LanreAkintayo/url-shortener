import { Request, Response, NextFunction } from "express";
import redisClient from "../config/redis";

// You can only send 10 requests per minute from the same IP address
const RATE_LIMIT_WINDOW_MS = 30 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

export const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Let's get the ip address of the client
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `rate_limit:${ip}`;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    // Let's open one atomic pipeline
    const multi = redisClient.multi();

    // Remove timestamps that are outside the current window
    multi.zRemRangeByScore(key, 0, windowStart);

    // Add the new entry. Entry has to be unique
    multi.zAdd(key, { score: now, value: `${now}-${Math.random()}` });

    // Get the count of requests in the current window
    multi.zCard(key);

    // Get the oldest valid entry in the window
    multi.zRange(key, 0, 0);

    // Set expiration for the key to to avoid memory leaks
    multi.expire(key, RATE_LIMIT_WINDOW_MS / 1000);

    // Execute the pipeline
    const results = await multi.exec();

    if (!results) {
      throw new Error("Failed to execute Redis pipeline");
    }

    const requestCount = results[2] as unknown as number;
    const oldestEntry = results[3] as unknown as string[];

    if (requestCount > MAX_REQUESTS_PER_WINDOW) {
      let resetTimeInSeconds = 60; // Default to 60 seconds.
      if (oldestEntry.length && oldestEntry.length > 0) {
        const oldestTimestamp = parseInt(oldestEntry[0].split("-")[0]);
         resetTimeInSeconds = Math.ceil(
          (oldestTimestamp + RATE_LIMIT_WINDOW_MS - now) / 1000,
        );
      }

      res.setHeader("X-RateLimit-Limit", MAX_REQUESTS_PER_WINDOW);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", resetTimeInSeconds);

      res.status(429).json({
        status: "error",
        message: `Too many requests. You can only make ${MAX_REQUESTS_PER_WINDOW} requests per minute.`,
        retryAfter: `${resetTimeInSeconds} seconds`,
      });
      return;
    }

    res.setHeader("X-RateLimit-Limit", MAX_REQUESTS_PER_WINDOW);
    res.setHeader(
      "X-RateLimit-Remaining",
      MAX_REQUESTS_PER_WINDOW - requestCount,
    );

    next();
  } catch (error) {
    console.error("Error in rate limiter middleware: ", error);
    // In case of an error in the rate limiter, we don't want to block the request. We log the error and allow the request to proceed.
    next();
  }
};
