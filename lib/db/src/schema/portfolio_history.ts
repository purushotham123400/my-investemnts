import { pgTable, serial, timestamp, doublePrecision, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portfolioHistoryTable = pgTable("portfolio_history", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  totalValue: doublePrecision("total_value").notNull(),
  totalInvested: doublePrecision("total_invested").notNull(),
  profitLoss: doublePrecision("profit_loss").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPortfolioHistorySchema = createInsertSchema(portfolioHistoryTable).omit({ id: true, createdAt: true });
export type InsertPortfolioHistory = z.infer<typeof insertPortfolioHistorySchema>;
export type PortfolioHistory = typeof portfolioHistoryTable.$inferSelect;
