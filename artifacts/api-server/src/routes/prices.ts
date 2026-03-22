import { Router, type IRouter } from "express";
import { db, holdingsTable, priceCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const USD_TO_INR = 83.5;

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function fetchCryptoPrice(coinId: string): Promise<{ price: number; change: number; changePercent: number }> {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=inr&include_24hr_change=true`;
    const apiKey = process.env.COINGECKO_API_KEY ?? "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, headers: { "x-cg-demo-api-key": apiKey } });
    clearTimeout(timeout);
    const data = await res.json() as Record<string, { inr: number; inr_24h_change: number }>;
    const coin = data[coinId];
    if (!coin) throw new Error("No data");
    const price = coin.inr;
    const changePercent = coin.inr_24h_change ?? 0;
    const change = (price / (1 + changePercent / 100)) * (changePercent / 100);
    return { price, change, changePercent };
  } catch {
    return { price: 0, change: 0, changePercent: 0 };
  }
}

async function fetchYahooFinance(symbol: string): Promise<{ price: number; change: number; changePercent: number }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetchWithTimeout(url);
    const data = await res.json() as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number; chartPreviousClose?: number; currency?: string };
        }>;
      };
    };
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) throw new Error("No price data");

    let price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? price;
    const currency = meta.currency ?? "USD";

    if (currency === "USD") {
      price = price * USD_TO_INR;
      const prevCloseInr = prevClose * USD_TO_INR;
      const change = price - prevCloseInr;
      const changePercent = prevClose ? ((price - prevCloseInr) / prevCloseInr) * 100 : 0;
      return { price, change, changePercent };
    }

    const change = price - prevClose;
    const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
    return { price, change, changePercent };
  } catch {
    return { price: 0, change: 0, changePercent: 0 };
  }
}

async function fetchAndCacheMarketPrices() {
  const [nifty50, niftyIT, niftyBank, sp500, nasdaq100, gold, btc, eth, sol] = await Promise.all([
    fetchYahooFinance("^NSEI"),
    fetchYahooFinance("^CNXIT"),
    fetchYahooFinance("^NSEBANK"),
    fetchYahooFinance("^GSPC"),
    fetchYahooFinance("^NDX"),
    fetchYahooFinance("GC=F"),
    fetchCryptoPrice("bitcoin"),
    fetchCryptoPrice("ethereum"),
    fetchCryptoPrice("solana"),
  ]);

  const entries = [
    { key: "nifty50", label: "Nifty 50", ...nifty50 },
    { key: "niftyIT", label: "Nifty IT", ...niftyIT },
    { key: "niftyBank", label: "Nifty Bank", ...niftyBank },
    { key: "btc", label: "BTC", ...btc },
    { key: "eth", label: "ETH", ...eth },
    { key: "sol", label: "SOL", ...sol },
    { key: "sp500", label: "S&P 500", ...sp500 },
    { key: "nasdaq100", label: "Nasdaq 100", ...nasdaq100 },
    { key: "gold", label: "Gold", ...gold },
  ];

  for (const entry of entries) {
    try {
      await db
        .insert(priceCacheTable)
        .values(entry)
        .onConflictDoUpdate({
          target: priceCacheTable.key,
          set: {
            price: entry.price,
            change: entry.change,
            changePercent: entry.changePercent,
            label: entry.label,
            updatedAt: new Date(),
          },
        });
    } catch (_err) {
    }
  }

  return entries;
}

let lastFetch = 0;
const CACHE_TTL = 60 * 60 * 1000;

router.get("/", async (req, res) => {
  try {
    const now = Date.now();
    let entries;

    if (now - lastFetch > CACHE_TTL) {
      lastFetch = now;
      entries = await fetchAndCacheMarketPrices();
    } else {
      const cached = await db.select().from(priceCacheTable);
      if (cached.length >= 9) {
        entries = cached.map((c) => ({
          key: c.key,
          label: c.label,
          price: c.price,
          change: c.change,
          changePercent: c.changePercent,
        }));
      } else {
        lastFetch = now;
        entries = await fetchAndCacheMarketPrices();
      }
    }

    const map: Record<string, { price: number; change: number; changePercent: number; label: string }> = {};
    for (const e of entries) {
      map[e.key] = { price: e.price, change: e.change, changePercent: e.changePercent, label: e.label };
    }

    res.json({
      nifty50: map["nifty50"] ?? { price: 0, change: 0, changePercent: 0, label: "Nifty 50" },
      niftyIT: map["niftyIT"] ?? { price: 0, change: 0, changePercent: 0, label: "Nifty IT" },
      niftyBank: map["niftyBank"] ?? { price: 0, change: 0, changePercent: 0, label: "Nifty Bank" },
      btc: map["btc"] ?? { price: 0, change: 0, changePercent: 0, label: "BTC" },
      eth: map["eth"] ?? { price: 0, change: 0, changePercent: 0, label: "ETH" },
      sol: map["sol"] ?? { price: 0, change: 0, changePercent: 0, label: "SOL" },
      sp500: map["sp500"] ?? { price: 0, change: 0, changePercent: 0, label: "S&P 500" },
      nasdaq100: map["nasdaq100"] ?? { price: 0, change: 0, changePercent: 0, label: "Nasdaq 100" },
      gold: map["gold"] ?? { price: 0, change: 0, changePercent: 0, label: "Gold" },
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get market prices");
    res.status(500).json({ error: "Failed to get market prices" });
  }
});

export async function getHoldingCurrentPrices(symbols: string[]): Promise<Map<string, { price: number; change: number; changePercent: number }>> {
  const results = new Map<string, { price: number; change: number; changePercent: number }>();

  const CRYPTO_SYMBOLS: Record<string, string> = {
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    BNB: "binancecoin",
    DOGE: "dogecoin",
    XRP: "ripple",
    ADA: "cardano",
    AVAX: "avalanche-2",
    DOT: "polkadot",
    MATIC: "matic-network",
    LINK: "chainlink",
    LTC: "litecoin",
    UNI: "uniswap",
    SHIB: "shiba-inu",
    TRX: "tron",
    ATOM: "cosmos",
  };

  await Promise.all(
    symbols.map(async (symbol) => {
      const upperSym = symbol.toUpperCase();
      if (CRYPTO_SYMBOLS[upperSym]) {
        const data = await fetchCryptoPrice(CRYPTO_SYMBOLS[upperSym]);
        results.set(upperSym, data);
      } else {
        const yahooSymbol = upperSym.endsWith(".NS") ? upperSym : `${upperSym}.NS`;
        const data = await fetchYahooFinance(yahooSymbol);
        if (data.price === 0) {
          const directData = await fetchYahooFinance(upperSym);
          results.set(upperSym, directData);
        } else {
          results.set(upperSym, data);
        }
      }
    })
  );

  return results;
}

router.get("/holdings", async (req, res) => {
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
    req.log.error({ err }, "Failed to get holding prices");
    res.status(500).json({ error: "Failed to get holding prices" });
  }
});

export default router;
