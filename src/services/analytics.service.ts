import { db } from "../config/db";
import { urlAnalytics } from "../db/schema";

interface BatchAnalyticsData {
  shortCodes: string[];
  ipAddresses: string[];
  userAgents: string[];
  referrers: string[];
  timestamps: string[];
}

export const logBatchAnalytics = async (
  data: BatchAnalyticsData,
): Promise<void> => {
  if (!data.shortCodes?.length) return;

  const analyticsPayload = data.shortCodes.map((shortCode, index) => ({
    shortCode,
    ipAddress: data.ipAddresses[index],
    userAgent: data.userAgents[index],
    referrer: data.referrers[index],
    createdAt: data.timestamps[index],
  }));

  await db.write.insert(urlAnalytics).values(analyticsPayload);
};
