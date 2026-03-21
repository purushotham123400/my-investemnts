import { pgTable, text, serial, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const priceCacheTable = pgTable("price_cache", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  price: doublePrecision("price").notNull(),
  change: doublePrecision("change").notNull().default(0),
  changePercent: doublePrecision("change_percent").notNull().default(0),
  label: text("label").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPriceCacheSchema = createInsertSchema(priceCacheTable).omit({ id: true });
export type InsertPriceCache = z.infer<typeof insertPriceCacheSchema>;
export type PriceCache = typeof priceCacheTable.$inferSelect;
