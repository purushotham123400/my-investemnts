import { Router, type IRouter } from "express";
import { db, priceAlertsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getHoldingCurrentPrices } from "./prices";
import { sendAlertEmail } from "../lib/mailer";

const router: IRouter = Router();

function formatAlert(a: typeof priceAlertsTable.$inferSelect) {
  return {
    ...a,
    triggeredAt: a.triggeredAt ? a.triggeredAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const alerts = await db
      .select()
      .from(priceAlertsTable)
      .orderBy(priceAlertsTable.createdAt);
    res.json(alerts.map(formatAlert));
  } catch (err) {
    req.log.error({ err }, "Failed to get alerts");
    res.status(500).json({ error: "Failed to get alerts" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { symbol, name, targetPrice, direction } = req.body;
    if (!symbol || !name || targetPrice == null || !direction) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    if (!["above", "below"].includes(direction)) {
      res.status(400).json({ error: "direction must be 'above' or 'below'" });
      return;
    }

    const [alert] = await db
      .insert(priceAlertsTable)
      .values({
        symbol: symbol.toUpperCase(),
        name,
        targetPrice: Number(targetPrice),
        direction,
        isActive: true,
        isTriggered: false,
      })
      .returning();

    res.status(201).json(formatAlert(alert));
  } catch (err) {
    req.log.error({ err }, "Failed to create alert");
    res.status(500).json({ error: "Failed to create alert" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isActive, isTriggered, targetPrice } = req.body;

    const [existing] = await db
      .select()
      .from(priceAlertsTable)
      .where(eq(priceAlertsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }

    const updates: Partial<typeof priceAlertsTable.$inferInsert> = {};
    if (isActive != null) updates.isActive = isActive;
    if (isTriggered != null) {
      updates.isTriggered = isTriggered;
      if (!isTriggered) updates.triggeredAt = undefined;
    }
    if (targetPrice != null) updates.targetPrice = Number(targetPrice);

    const [updated] = await db
      .update(priceAlertsTable)
      .set(updates)
      .where(eq(priceAlertsTable.id, id))
      .returning();

    res.json(formatAlert(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update alert");
    res.status(500).json({ error: "Failed to update alert" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(priceAlertsTable)
      .where(eq(priceAlertsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }

    await db.delete(priceAlertsTable).where(eq(priceAlertsTable.id, id));
    res.json({ message: "Alert deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete alert");
    res.status(500).json({ error: "Failed to delete alert" });
  }
});

router.post("/check", async (req, res) => {
  try {
    const activeAlerts = await db
      .select()
      .from(priceAlertsTable)
      .where(and(eq(priceAlertsTable.isActive, true), eq(priceAlertsTable.isTriggered, false)));

    if (activeAlerts.length === 0) {
      res.json([]);
      return;
    }

    const symbols = [...new Set(activeAlerts.map((a) => a.symbol))];
    const priceMap = await getHoldingCurrentPrices(symbols);

    const triggered: typeof activeAlerts = [];
    const emailPayloads: Parameters<typeof sendAlertEmail>[0] = [];

    for (const alert of activeAlerts) {
      const pd = priceMap.get(alert.symbol.toUpperCase());
      if (!pd || pd.price === 0) continue;

      const isTriggered =
        (alert.direction === "above" && pd.price >= alert.targetPrice) ||
        (alert.direction === "below" && pd.price <= alert.targetPrice);

      if (isTriggered) {
        const [updated] = await db
          .update(priceAlertsTable)
          .set({ isTriggered: true, triggeredAt: new Date() })
          .where(eq(priceAlertsTable.id, alert.id))
          .returning();

        triggered.push(updated);

        emailPayloads.push({
          symbol: alert.symbol,
          name: alert.name,
          targetPrice: alert.targetPrice,
          direction: alert.direction as "above" | "below",
          currentPrice: pd.price,
          triggeredAt: new Date().toISOString(),
        });
      }
    }

    if (emailPayloads.length > 0) {
      sendAlertEmail(emailPayloads).catch((err) =>
        req.log.error({ err }, "Background email send failed")
      );
    }

    res.json(triggered.map(formatAlert));
  } catch (err) {
    req.log.error({ err }, "Failed to check alerts");
    res.status(500).json({ error: "Failed to check alerts" });
  }
});

export default router;
