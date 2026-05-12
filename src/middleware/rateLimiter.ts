import { Request, Response, NextFunction } from "express";
import redisClient from "../config/redis";
import { logger } from "../utils/logger";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

/**
 * Sliding window rate limiter middleware using Redis sorted sets.
 * Fails open (allows the request) if Redis is unreachable to prevent cascading system failures.
 */
export const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `rate_limit:${ip}`;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    const multi = redisClient.multi();

    multi.zRemRangeByScore(key, 0, windowStart);
    multi.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
    multi.zCard(key);
    multi.zRange(key, 0, 0);
    multi.expire(key, RATE_LIMIT_WINDOW_MS / 1000);

    const results = await multi.exec();

    if (!results) {
      throw new Error("Failed to execute Redis pipeline");
    }

    const requestCount = results[2] as unknown as number;
    const oldestEntry = results[3] as unknown as string[];

    if (requestCount > MAX_REQUESTS_PER_WINDOW) {
      let resetTimeInSeconds = 60;
      
      if (oldestEntry.length && oldestEntry.length > 0) {
        const oldestTimestamp = parseInt(oldestEntry[0].split("-")[0]);
        resetTimeInSeconds = Math.ceil(
          (oldestTimestamp + RATE_LIMIT_WINDOW_MS - now) / 1000,
        );
      }

      logger.warn(
        { ip, requestCount, limit: MAX_REQUESTS_PER_WINDOW, service: "rate_limiter" },
        "Rate limit exceeded"
      );

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
    logger.error(
      { err: error, service: "rate_limiter" },
      "Rate limiter execution failed. Bypassing restriction."
    );
    next();
  }
};