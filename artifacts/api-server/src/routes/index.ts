import { Router, type IRouter } from "express";
import healthRouter from "./health";
import holdingsRouter from "./holdings";
import pricesRouter, { getHoldingCurrentPrices } from "./prices";
import historyRouter from "./history";
import { db, holdingsTable } from "@workspace/db";

const router: IRouter = Router();

router.use(healthRouter);

router.get("/holdings/prices", async (req, res) => {
  try {
    const holdings = await db.select().from(holdingsTable);
    const symbols = holdings.map((h) => h.symbol);
    const priceMap = await getHoldingCurrentPrices(symbols);

    const result = holdings.map((h) => {
      const pd = priceMap.get(h.symbol.toUpperCase()) ?? { price: 0, change: 0, changePercent: 0 };
      return {
        symbol: h.symbol,
        price: pd.price,
        change: pd.change,
        changePercent: pd.changePercent,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to get holding prices" });
  }
});

router.use("/holdings", holdingsRouter);
router.use("/prices", pricesRouter);
router.use("/history", historyRouter);

export default router;
