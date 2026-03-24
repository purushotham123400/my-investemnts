import { Router, type IRouter } from "express";
import { db, holdingsTable, deletedHoldingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const holdings = await db.select().from(holdingsTable).orderBy(holdingsTable.createdAt);
    res.json(holdings);
  } catch (err) {
    req.log.error({ err }, "Failed to get holdings");
    res.status(500).json({ error: "Failed to get holdings" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { symbol, name, type, quantity, buyPrice, note } = req.body;
    if (!symbol || !name || !type || quantity == null || buyPrice == null) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const [holding] = await db
      .insert(holdingsTable)
      .values({
        symbol: symbol.toUpperCase(),
        name,
        type,
        quantity: Number(quantity),
        avgBuyPrice: Number(buyPrice),
        note: note ?? null,
      })
      .returning();
    res.status(201).json(holding);
  } catch (err) {
    req.log.error({ err }, "Failed to create holding");
    res.status(500).json({ error: "Failed to create holding" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { action, quantity, buyPrice, note } = req.body;

    const [existing] = await db.select().from(holdingsTable).where(eq(holdingsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Holding not found" }); return; }

    let updates: Partial<typeof holdingsTable.$inferInsert> = {};

    if (action === "add") {
      const addQty = Number(quantity);
      const addPrice = Number(buyPrice);
      const newAvgPrice = (existing.avgBuyPrice * existing.quantity + addPrice * addQty) / (existing.quantity + addQty);
      updates = { quantity: existing.quantity + addQty, avgBuyPrice: newAvgPrice };
    } else if (action === "reduce") {
      const reduceQty = Number(quantity);
      if (reduceQty >= existing.quantity) {
        // Move to bin
        try {
          await db.insert(deletedHoldingsTable).values({
            originalId: existing.id,
            symbol: existing.symbol,
            name: existing.name,
            type: existing.type,
            quantity: existing.quantity,
            avgBuyPrice: existing.avgBuyPrice,
            note: existing.note ?? null,
            originalCreatedAt: existing.createdAt,
          });
        } catch (binErr) {
          req.log.warn({ binErr }, "Could not move to bin, will permanently delete");
        }
        await db.delete(holdingsTable).where(eq(holdingsTable.id, id));
        res.json({ message: "Holding deleted as quantity reached zero" });
        return;
      }
      updates = { quantity: existing.quantity - reduceQty };
    } else if (action === "update_note") {
      updates = { note: note ?? null };
    } else {
      res.status(400).json({ error: "Invalid action" });
      return;
    }

    const [updated] = await db.update(holdingsTable).set(updates).where(eq(holdingsTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update holding");
    res.status(500).json({ error: "Failed to update holding" });
  }
});

// Soft delete - moves to bin, falls back to permanent delete if bin fails
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(holdingsTable).where(eq(holdingsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Holding not found" }); return; }

    // Try to move to bin
    try {
      await db.insert(deletedHoldingsTable).values({
        originalId: existing.id,
        symbol: existing.symbol,
        name: existing.name,
        type: existing.type,
        quantity: existing.quantity,
        avgBuyPrice: existing.avgBuyPrice,
        note: existing.note ?? null,
        originalCreatedAt: existing.createdAt,
      });
      await db.delete(holdingsTable).where(eq(holdingsTable.id, id));
      res.json({ message: "Holding moved to bin" });
    } catch (binErr) {
      req.log.error({ binErr }, "Bin insert failed, attempting permanent delete");
      await db.delete(holdingsTable).where(eq(holdingsTable.id, id));
      res.json({ message: "Holding deleted" });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to delete holding");
    res.status(500).json({ error: "Failed to delete holding" });
  }
});

export default router;
