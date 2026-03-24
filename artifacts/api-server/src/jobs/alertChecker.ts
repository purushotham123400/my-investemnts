import { db, priceAlertsTable, holdingsTable, portfolioHistoryTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { getHoldingCurrentPrices } from "../routes/prices";
import { sendAlertEmail } from "../lib/mailer";
import { logger } from "../lib/logger";

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

function getIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return { h: ist.getUTCHours(), m: ist.getUTCMinutes(), dateStr: ist.toISOString().split("T")[0] };
}

async function takePortfolioSnapshot(dateStr: string) {
  try {
    const holdings = await db.select().from(holdingsTable);
    if (holdings.length === 0) return;
    const symbols = holdings.map((h) => h.symbol);
    const priceMap = await getHoldingCurrentPrices(symbols);
    let totalInvested = 0, totalValue = 0;
    for (const h of holdings) {
      const pd = priceMap.get(h.symbol.toUpperCase());
      const price = pd?.price ?? h.avgBuyPrice;
      totalInvested += h.quantity * h.avgBuyPrice;
      totalValue += h.quantity * price;
    }
    const profitLoss = totalValue - totalInvested;
    const existing = await db.select().from(portfolioHistoryTable).where(gte(portfolioHistoryTable.date, dateStr));
    const todayRecord = existing.find((r) => r.date === dateStr);
    if (todayRecord) {
      await db.update(portfolioHistoryTable).set({ totalValue, totalInvested, profitLoss }).where(eq(portfolioHistoryTable.id, todayRecord.id));
      logger.info({ dateStr, totalValue }, "Portfolio snapshot updated");
    } else {
      await db.insert(portfolioHistoryTable).values({ date: dateStr, totalValue, totalInvested, profitLoss });
      logger.info({ dateStr, totalValue }, "Portfolio snapshot created");
    }
  } catch (err) {
    logger.error({ err }, "Portfolio snapshot failed");
  }
}

async function runAlertCheck() {
  try {
    const activeAlerts = await db.select().from(priceAlertsTable).where(and(eq(priceAlertsTable.isActive, true), eq(priceAlertsTable.isTriggered, false)));
    if (activeAlerts.length === 0) return;
    const symbols = [...new Set(activeAlerts.map((a) => a.symbol))];
    const priceMap = await getHoldingCurrentPrices(symbols);
    const emailPayloads: Parameters<typeof sendAlertEmail>[0] = [];
    for (const alert of activeAlerts) {
      const pd = priceMap.get(alert.symbol.toUpperCase());
      if (!pd || pd.price === 0) continue;
      const triggered = (alert.direction === "above" && pd.price >= alert.targetPrice) || (alert.direction === "below" && pd.price <= alert.targetPrice);
      if (triggered) {
        await db.update(priceAlertsTable).set({ isTriggered: true, triggeredAt: new Date() }).where(eq(priceAlertsTable.id, alert.id));
        emailPayloads.push({ symbol: alert.symbol, name: alert.name, targetPrice: alert.targetPrice, direction: alert.direction as "above" | "below", currentPrice: pd.price, triggeredAt: new Date().toISOString() });
      }
    }
    if (emailPayloads.length > 0) {
      await sendAlertEmail(emailPayloads);
      logger.info({ count: emailPayloads.length }, "Alert emails sent");
    }
  } catch (err) {
    logger.error({ err }, "Alert check error");
  }
}

export function startAlertChecker() {
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Background alert checker started");
  runAlertCheck();
  setInterval(runAlertCheck, CHECK_INTERVAL_MS);
  let lastMinuteKey = -1;
  setInterval(async () => {
    const { h, m, dateStr } = getIST();
    const minuteKey = h * 60 + m;
    if (minuteKey === lastMinuteKey) return;
    lastMinuteKey = minuteKey;
    if (h === 23 && m === 59) { logger.info("EOD snapshot 11:59 PM IST"); await takePortfolioSnapshot(dateStr); }
    if (h === 0 && m === 0)   { logger.info("New day entry 12:00 AM IST"); await takePortfolioSnapshot(dateStr); }
  }, 60_000);
}
