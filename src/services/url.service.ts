import { pool } from "../config/db";
import { nanoid } from "nanoid";

export const createShortUrl = async (longUrl: string) => {
  const shortCode = nanoid(8);

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
  const query = `
    SELECT long_url FROM urls
    WHERE short_code = $1;
    `;
  const values = [shortCode];

  const result = await pool.query(query, values);
  return result.rows[0];
};
