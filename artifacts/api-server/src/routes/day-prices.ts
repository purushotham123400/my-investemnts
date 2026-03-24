import { Router, type IRouter } from "express";
import { db, holdingsTable, holdingDayPricesTable, portfolioHistoryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getHoldingCurrentPrices } from "./prices";

const router: IRouter = Router();

function getISTDate(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

// Save end-of-day prices for all holdings + portfolio history snapshot
export async function saveDayEndPrices() {
  try {
    const holdings = await db.select().from(holdingsTable);
    if (holdings.length === 0) return;

    const today = getISTDate();
    const symbols = holdings.map((h) => h.symbol);
    const priceMap = await getHoldingCurrentPrices(symbols);

    // 1. Save each holding's end-of-day price
    for (const h of holdings) {
      const pd = priceMap.get(h.symbol.toUpperCase());
      if (!pd || pd.price === 0) continue;
      await db
        .insert(holdingDayPricesTable)
        .values({ symbol: h.symbol.toUpperCase(), date: today, price: pd.price })
        .onConflictDoNothing();
    }

    // 2. Save portfolio history snapshot for today (so line graph has data tomorrow)
    let totalInvested = 0;
    let totalValue = 0;
    for (const h of holdings) {
      const pd = priceMap.get(h.symbol.toUpperCase());
      const price = pd?.price ?? h.avgBuyPrice;
      totalInvested += h.quantity * h.avgBuyPrice;
      totalValue += h.quantity * price;
    }

    // Upsert: if today already has a snapshot, update it with latest values
    const existing = await db
      .select()
      .from(portfolioHistoryTable)
      .where(eq(portfolioHistoryTable.date, today));

    if (existing.length > 0) {
      await db
        .update(portfolioHistoryTable)
        .set({ totalValue, totalInvested, profitLoss: totalValue - totalInvested })
        .where(eq(portfolioHistoryTable.date, today));
    } else {
      await db.insert(portfolioHistoryTable).values({
        date: today,
        totalValue,
        totalInvested,
        profitLoss: totalValue - totalInvested,
      });
    }

    console.log(`[day-prices] Saved end-of-day snapshot for ${today}: invested=${totalInvested.toFixed(0)}, value=${totalValue.toFixed(0)}`);
  } catch (err) {
    console.error("[day-prices] Failed to save day end prices", err);
  }
}

function scheduleNextSave() {
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const nextSave = new Date(istNow);
  nextSave.setHours(23, 59, 0, 0);
  if (istNow >= nextSave) nextSave.setDate(nextSave.getDate() + 1);
  const delay = nextSave.getTime() - istNow.getTime();
  setTimeout(async () => {
    await saveDayEndPrices();
    scheduleNextSave();
  }, delay);
}

scheduleNextSave();

// GET /api/day-prices - returns yesterday's saved prices
router.get("/", async (req, res) => {
  try {
    const today = getISTDate();
    const allPrices = await db.select().from(holdingDayPricesTable);
    const bySymbol: Record<string, { price: number; date: string }> = {};
    for (const p of allPrices) {
      if (p.date >= today) continue;
      const existing = bySymbol[p.symbol];
      if (!existing || p.date > existing.date) bySymbol[p.symbol] = { price: p.price, date: p.date };
    }
    res.json(bySymbol);
  } catch (err) {
    req.log.error({ err }, "Failed to get day prices");
    res.status(500).json({ error: "Failed to get day prices" });
  }
});

// POST /api/day-prices/save-now - manually trigger save
router.post("/save-now", async (req, res) => {
  try {
    await saveDayEndPrices();
    res.json({ message: "Day prices saved" });
  } catch (err) {
    req.log.error({ err }, "Failed to save day prices");
    res.status(500).json({ error: "Failed to save" });
  }
});

export default router;
