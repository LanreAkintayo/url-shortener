import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres"; 
import * as schema from "../db/schema";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
});


export const db = drizzle(pool, { schema }); 


// A potential issue is here. I will revisi
pool.on("connect", () => {
    console.log("Connected to the database");
});

pool.on("error", (err) => {
    console.error("Database connection error:", err);
    process.exit(-1);
});