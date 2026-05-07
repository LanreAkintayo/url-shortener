import { pool } from "../config/db";
import redisClient from "../config/redis";
import { getShortCode } from "./kgs.service";

export const createShortUrl = async (longUrl: string) => {
  const shortCode = await getShortCode();

  const query = `
        INSERT INTO urls (long_url, short_code)
        VALUES ($1, $2)
        RETURNING id, long_url, short_code, created_at;
    `;
  const values = [longUrl, shortCode];

  const result = await pool.query(query, values);
  return result.rows[0];
};

export const getUrlByShortCode = async (shortCode: string | string[]) => {
  const cachedUrl = await redisClient.get(`url:${shortCode}`);

  if (cachedUrl) {
    return {long_url: cachedUrl};
  }

  const query = `
    SELECT long_url FROM urls
    WHERE short_code = $1;
    `;
  const values = [shortCode];

  const result = await pool.query(query, values);

  console.log("Database query result for short code ", shortCode, ": ", result);

  if (result.rows.length === 0) {
    return null;
  }

  const longUrl = result.rows[0].long_url;

  await redisClient.set(`url:${shortCode}`, longUrl, {
    EX: 60 * 60 * 24, // Cache for 24 hours
  });

  return result.rows[0];
};

export const updateOriginalUrl = async (
  shortCode: string | string[],
  newLongUrl: string,
) => {
  const query = `
  UPDATE urls
  SET long_url = $1
  WHERE short_code = $2
  RETURNING *;
  `;
  const values = [newLongUrl, shortCode];

  const result = await pool.query(query, values);

  if (result.rowCount === 0) {
    throw new Error("URL not found");
  }

  // Invalidate cache
  await redisClient.del(`url:${shortCode}`);

  return result.rows[0];
};

export const deleteUrl = async (shortCode: string | string[]) => {
  const query = `DELETE FROM urls WHERE short_code = $1 RETURNING *;`;
  const values = [shortCode];

  const result = await pool.query(query, values);

  console.log("Delete result: ", result);

  if (result.rowCount === 0) {
    throw new Error("URL not found");
  }

  // Invalidate cache
  await redisClient.del(`url:${shortCode}`);

  return true;
};
