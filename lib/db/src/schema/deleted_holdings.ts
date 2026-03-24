import { pgTable, text, serial, timestamp, doublePrecision, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deletedHoldingsTable = pgTable("deleted_holdings", {
  id: serial("id").primaryKey(),
  originalId: integer("original_id").notNull(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("stock"),
  quantity: doublePrecision("quantity").notNull(),
  avgBuyPrice: doublePrecision("avg_buy_price").notNull(),
  note: text("note"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
  originalCreatedAt: timestamp("original_created_at", { withTimezone: true }).notNull(),
});

export const insertDeletedHoldingSchema = createInsertSchema(deletedHoldingsTable).omit({ id: true });
export type InsertDeletedHolding = z.infer<typeof insertDeletedHoldingSchema>;
export type DeletedHolding = typeof deletedHoldingsTable.$inferSelect;
