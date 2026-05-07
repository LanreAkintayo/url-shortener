import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  index,
  foreignKey,
  bigint,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// any column with unique is automatically indexed, so no need to create an index for short_code
export const urls = pgTable("urls", {
  id: serial("id").primaryKey().notNull(),
  longUrl: text("long_url").notNull(),
  shortCode: varchar("short_code", { length: 8 }).notNull().unique(),
  createAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(), 
});

export const keyPool = pgTable("key_pool", {
  id: serial("id").primaryKey().notNull(),
  shortCode: varchar("short_code", { length: 8 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const kgsState = pgTable("kgs_state", {
  id: serial("id").primaryKey().notNull(),
  currentCounter: bigint("current_counter", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const urlAnalytics = pgTable(
  "url_analytics",
  {
    id: serial("id").primaryKey().notNull(),
    shortCode: varchar("short_code", { length: 8 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    referrer: varchar("referrer", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.shortCode],
      foreignColumns: [urls.shortCode],
      name: "url_analytics_short_code_fkey", // [table_name]_[column_name]_fkey
    }).onDelete("cascade"),
    index("url_analytics_short_code_idx").on(table.shortCode),
  ],
);
