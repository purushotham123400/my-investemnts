import { Router, type IRouter } from "express";
import { db, priceAlertsTable, holdingsTable, priceCacheTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getHoldingCurrentPrices } from "./prices";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const alerts = await db
      .select()
      .from(priceAlertsTable)
      .orderBy(priceAlertsTable.createdAt);
    res.json(
      alerts.map((a) => ({
        ...a,
        triggeredAt: a.triggeredAt ? a.triggeredAt.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
      }))
    );
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

    res.status(201).json({
      ...alert,
      triggeredAt: alert.triggeredAt ? alert.triggeredAt.toISOString() : null,
      createdAt: alert.createdAt.toISOString(),
    });
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

    res.json({
      ...updated,
      triggeredAt: updated.triggeredAt ? updated.triggeredAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    });
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
    req.log.error({ err }, "Failed to delete alert" );
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
      }
    }

    res.json(
      triggered.map((a) => ({
        ...a,
        triggeredAt: a.triggeredAt ? a.triggeredAt.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to check alerts");
    res.status(500).json({ error: "Failed to check alerts" });
  }
});

export default router;
