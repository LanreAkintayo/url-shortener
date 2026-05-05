import { pool } from "../config/db";


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
    // Using UNNEST for batch insertion to optimize performance and reduce the number of individual insert queries.
    
  const query = `
      INSERT INTO url_analytics (short_code, ip_address, user_agent, referrer, created_at)
      SELECT * FROM UNNEST (
        $1::varchar[],
        $2::varchar[],
        $3::text[],
        $4::varchar[],
        $5::timestamptz[]
      )
    `;

  await pool.query(query, [
    data.shortCodes,
    data.ipAddresses,
    data.userAgents,
    data.referrers,
    data.timestamps,
  ]);
};
