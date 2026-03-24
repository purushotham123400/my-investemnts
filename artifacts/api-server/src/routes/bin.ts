import { Router, type IRouter } from "express";
import { db, deletedHoldingsTable, holdingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/bin - list deleted holdings
router.get("/", async (req, res) => {
  try {
    const items = await db.select().from(deletedHoldingsTable).orderBy(deletedHoldingsTable.deletedAt);
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to get bin");
    res.status(500).json({ error: "Failed to get bin" });
  }
});

// POST /api/bin/:id/restore - restore to holdings
router.post("/:id/restore", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [item] = await db.select().from(deletedHoldingsTable).where(eq(deletedHoldingsTable.id, id));
    if (!item) { res.status(404).json({ error: "Not found" }); return; }

    const [restored] = await db.insert(holdingsTable).values({
      symbol: item.symbol,
      name: item.name,
      type: item.type,
      quantity: item.quantity,
      avgBuyPrice: item.avgBuyPrice,
      note: item.note,
      createdAt: item.originalCreatedAt,
    }).returning();

    await db.delete(deletedHoldingsTable).where(eq(deletedHoldingsTable.id, id));
    res.json(restored);
  } catch (err) {
    req.log.error({ err }, "Failed to restore holding");
    res.status(500).json({ error: "Failed to restore" });
  }
});

// DELETE /api/bin/:id - permanently delete
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(deletedHoldingsTable).where(eq(deletedHoldingsTable.id, id));
    res.json({ message: "Permanently deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to permanently delete");
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
