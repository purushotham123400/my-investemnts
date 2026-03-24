import { Router, type IRouter } from "express";
import { db, portfolioHistoryTable } from "@workspace/db";
import { gte, desc, eq } from "drizzle-orm";

const router: IRouter = Router();

function getDateRange(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "1m":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "3m":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "6m":
      return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    case "1y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case "all":
    default:
      return null;
  }
}

router.get("/", async (req, res) => {
  try {
    const range = (req.query.range as string) ?? "1m";
    const from = getDateRange(range);

    let query;
    if (from) {
      const fromStr = from.toISOString().split("T")[0];
      query = db
        .select()
        .from(portfolioHistoryTable)
        .where(gte(portfolioHistoryTable.date, fromStr))
        .orderBy(portfolioHistoryTable.date);
    } else {
      query = db
        .select()
        .from(portfolioHistoryTable)
        .orderBy(portfolioHistoryTable.date);
    }

    const history = await query;
    res.json(history);
  } catch (err) {
    req.log.error({ err }, "Failed to get portfolio history");
    res.status(500).json({ error: "Failed to get portfolio history" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { totalValue, totalInvested, profitLoss } = req.body;

    const today = new Date().toISOString().split("T")[0];

    const existing = await db
      .select()
      .from(portfolioHistoryTable)
      .where(gte(portfolioHistoryTable.date, today));

    const todayRecord = existing.find((r) => r.date === today);

    if (todayRecord) {
      const [updated] = await db
        .update(portfolioHistoryTable)
        .set({ totalValue, totalInvested, profitLoss })
        .where(eq(portfolioHistoryTable.id, todayRecord.id))
        .returning();
      res.status(201).json(updated);
      return;
    }

    const [record] = await db
      .insert(portfolioHistoryTable)
      .values({
        date: today,
        totalValue: Number(totalValue),
        totalInvested: Number(totalInvested),
        profitLoss: Number(profitLoss),
      })
      .returning();

    res.status(201).json(record);
  } catch (err) {
    req.log.error({ err }, "Failed to record portfolio snapshot");
    res.status(500).json({ error: "Failed to record snapshot" });
  }
});

export default router;
