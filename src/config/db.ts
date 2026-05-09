import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres"; 
import * as schema from "../db/schema";
import dotenv from "dotenv";

dotenv.config();

const writePool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const readPool = new Pool({
    connectionString: process.env.REPLICA_DATABASE_URL,
});

export const db = {
    write: drizzle(writePool, { schema }),
    read: drizzle(readPool, { schema }), 
};

writePool.on("connect", () => console.log("Primary DB connection established"));
readPool.on("connect", () => console.log("Replica DB connection established"));

writePool.on("error", (err) => {
    console.error("Primary DB connection error:", err);
    process.exit(-1);
});

readPool.on("error", (err) => {
    console.error("Replica DB connection error:", err);
    process.exit(-1);
});