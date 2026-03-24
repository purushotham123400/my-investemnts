import { pgTable, text, serial, timestamp, doublePrecision } from "drizzle-orm/pg-core";

export const holdingDayPricesTable = pgTable("holding_day_prices", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  date: text("date").notNull(), // IST date YYYY-MM-DD
  price: doublePrecision("price").notNull(),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HoldingDayPrice = typeof holdingDayPricesTable.$inferSelect;
