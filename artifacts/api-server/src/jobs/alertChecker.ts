import { db, priceAlertsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getHoldingCurrentPrices } from "../routes/prices";
import { sendAlertEmail } from "../lib/mailer";
import { logger } from "../lib/logger";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function runAlertCheck() {
  try {
    const activeAlerts = await db
      .select()
      .from(priceAlertsTable)
      .where(and(eq(priceAlertsTable.isActive, true), eq(priceAlertsTable.isTriggered, false)));

    if (activeAlerts.length === 0) {
      logger.info("Alert checker: no active alerts");
      return;
    }

    const symbols = [...new Set(activeAlerts.map((a) => a.symbol))];
    const priceMap = await getHoldingCurrentPrices(symbols);

    const emailPayloads: Parameters<typeof sendAlertEmail>[0] = [];

    for (const alert of activeAlerts) {
      const pd = priceMap.get(alert.symbol.toUpperCase());
      if (!pd || pd.price === 0) continue;

      const isTriggered =
        (alert.direction === "above" && pd.price >= alert.targetPrice) ||
        (alert.direction === "below" && pd.price <= alert.targetPrice);

      if (isTriggered) {
        await db
          .update(priceAlertsTable)
          .set({ isTriggered: true, triggeredAt: new Date() })
          .where(eq(priceAlertsTable.id, alert.id));

        emailPayloads.push({
          symbol: alert.symbol,
          name: alert.name,
          targetPrice: alert.targetPrice,
          direction: alert.direction as "above" | "below",
          currentPrice: pd.price,
          triggeredAt: new Date().toISOString(),
        });

        logger.info(
          { symbol: alert.symbol, direction: alert.direction, target: alert.targetPrice, current: pd.price },
          "Alert triggered"
        );
      }
    }

    if (emailPayloads.length > 0) {
      await sendAlertEmail(emailPayloads);
      logger.info({ count: emailPayloads.length }, "Alert emails sent");
    }
  } catch (err) {
    logger.error({ err }, "Alert checker error");
  }
}

export function startAlertChecker() {
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Background alert checker started");
  // Run once immediately on startup, then every 5 minutes
  runAlertCheck();
  setInterval(runAlertCheck, CHECK_INTERVAL_MS);
}
