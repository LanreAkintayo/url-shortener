import { getDbByShardId } from "../config/db";
import { urlAnalytics } from "../db/schema";

type InsertAnalyticsType = typeof urlAnalytics.$inferInsert;

export const logBatchAnalytics = async (
  shardId: number,
  data: InsertAnalyticsType[],
): Promise<void> => {
  if (!data || data.length === 0) return;

  const targetDb = getDbByShardId(shardId);

  await targetDb.write.insert(urlAnalytics).values(data);
};