import { Router, type IRouter } from "express";
import { db, holdingsTable, holdingDayPricesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getHoldingCurrentPrices } from "./prices";

const router: IRouter = Router();

function getISTDate(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

// Save current prices for all holdings as end-of-day prices
export async function saveDayEndPrices() {
  try {
    const holdings = await db.select().from(holdingsTable);
    if (holdings.length === 0) return;
    const today = getISTDate();
    const symbols = holdings.map((h) => h.symbol);
    const priceMap = await getHoldingCurrentPrices(symbols);

    for (const h of holdings) {
      const pd = priceMap.get(h.symbol.toUpperCase());
      if (!pd || pd.price === 0) continue;
      await db
        .insert(holdingDayPricesTable)
        .values({ symbol: h.symbol.toUpperCase(), date: today, price: pd.price })
        .onConflictDoNothing();
    }
  } catch (err) {
    console.error("Failed to save day end prices", err);
  }
}

// Schedule save at 23:59 IST
function scheduleNextSave() {
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const nextSave = new Date(istNow);
  nextSave.setHours(23, 59, 0, 0);
  if (istNow >= nextSave) {
    nextSave.setDate(nextSave.getDate() + 1);
  }
  const delay = nextSave.getTime() - istNow.getTime();
  setTimeout(async () => {
    await saveDayEndPrices();
    scheduleNextSave();
  }, delay);
}

scheduleNextSave();

// GET /api/day-prices - returns yesterday's saved prices (for today's P/L)
router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const today = istNow.toISOString().split("T")[0];
    const yesterday = new Date(istNow.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Get all saved prices - pick most recent entry per symbol that is before today
    const allPrices = await db.select().from(holdingDayPricesTable);
    
    // Group by symbol, pick the latest date that is < today
    const bySymbol: Record<string, { price: number; date: string }> = {};
    for (const p of allPrices) {
      if (p.date >= today) continue; // skip today's prices (we want yesterday's close)
      const existing = bySymbol[p.symbol];
      if (!existing || p.date > existing.date) {
        bySymbol[p.symbol] = { price: p.price, date: p.date };
      }
    }
    res.json(bySymbol);
  } catch (err) {
    req.log.error({ err }, "Failed to get day prices");
    res.status(500).json({ error: "Failed to get day prices" });
  }
});

// POST /api/day-prices/save-now - manually trigger end-of-day save
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
