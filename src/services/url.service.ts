import { getDbShard } from "../config/db";
import redisClient from "../config/redis";
import { urls } from "../db/schema";
import { getShortCode } from "./kgs.service";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger";

export const createShortUrl = async (longUrl: string) => {
  const shortCode = await getShortCode();
  
  const targetDb = getDbShard(shortCode);

  const [newUrlRecord] = await targetDb.write
    .insert(urls)
    .values({ longUrl, shortCode })
    .returning({
      id: urls.id,
      longUrl: urls.longUrl,
      shortCode: urls.shortCode,
      createdAt: urls.createdAt,
    });

  return newUrlRecord;
};

export const getUrlByShortCode = async (shortCode: string | string[]) => {
  const code = Array.isArray(shortCode) ? shortCode[0] : shortCode;

  const cachedUrl = await redisClient.get(`url:${code}`);

  if (cachedUrl) {
    logger.debug({ shortCode: code, cache: "hit", service: "url_service" }, "Redis cache hit");
    return { longUrl: cachedUrl };
  }

  logger.debug({ shortCode: code, cache: "miss", service: "url_service" }, "Redis cache miss");

  const targetDb = getDbShard(code);

  const [urlRecord] = await targetDb.read
    .select({ longUrl: urls.longUrl })
    .from(urls)
    .where(eq(urls.shortCode, code))
    .limit(1);

  if (!urlRecord) {
    return null;
  }

  await redisClient.set(`url:${code}`, urlRecord.longUrl, {
    EX: 60 * 60 * 24, // Cache for 24 hours
  });

  return { longUrl: urlRecord.longUrl };
};

export const updateOriginalUrl = async (
  shortCode: string | string[],
  newLongUrl: string,
) => {
  const code = Array.isArray(shortCode) ? shortCode[0] : shortCode;
  
  const targetDb = getDbShard(code);

  const [updatedUrlRecord] = await targetDb.write
    .update(urls)
    .set({ longUrl: newLongUrl })
    .where(eq(urls.shortCode, code))
    .returning();

  if (!updatedUrlRecord) {
    throw new Error("URL not found");
  }

  await redisClient.del(`url:${code}`);
  logger.debug({ shortCode: code, action: "cache_invalidate", service: "url_service" }, "Redis cache invalidated");

  return updatedUrlRecord;
};

export const deleteUrl = async (shortCode: string | string[]) => {
  const code = Array.isArray(shortCode) ? shortCode[0] : shortCode;
  
  const targetDb = getDbShard(code);

  const [deletedUrlRecord] = await targetDb.write
    .delete(urls)
    .where(eq(urls.shortCode, code))
    .returning();

  if (!deletedUrlRecord) {
    throw new Error("URL not found");
  }

  await redisClient.del(`url:${code}`);
  logger.debug({ shortCode: code, action: "cache_invalidate", service: "url_service" }, "Redis cache invalidated");

  return true;
};