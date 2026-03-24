import { Router, type IRouter } from "express";
import { db, holdingsTable, priceCacheTable } from "@workspace/db";

const router: IRouter = Router();
const USD_TO_INR = 83.5;

// Yahoo Finance v7 quote API - works for indices & commodities
async function fetchYahooV7Quote(symbol: string): Promise<{ price: number; change: number; changePercent: number }> {
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const url = `https://${host}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,currency`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://finance.yahoo.com/',
        }
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json() as any;
      const quote = data?.quoteResponse?.result?.[0];
      if (!quote?.regularMarketPrice) continue;

      let price = quote.regularMarketPrice;
      let change = quote.regularMarketChange ?? 0;
      const changePercent = quote.regularMarketChangePercent ?? 0;

      if (quote.currency === "USD" || !quote.currency) {
        price = price * USD_TO_INR;
        change = change * USD_TO_INR;
      }
      return { price, change, changePercent };
    } catch { continue; }
  }
  return { price: 0, change: 0, changePercent: 0 };
}

// Yahoo Finance v8 chart API - works well for Indian indices
async function fetchYahooV8Chart(symbol: string): Promise<{ price: number; change: number; changePercent: number }> {
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://finance.yahoo.com/',
        }
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json() as any;
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) continue;
      let price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose ?? price;
      const currency = meta.currency ?? "INR";
      if (currency === "USD") {
        price = price * USD_TO_INR;
        const prevCloseInr = prevClose * USD_TO_INR;
        return { price, change: price - prevCloseInr, changePercent: prevClose ? ((price - prevCloseInr) / prevCloseInr) * 100 : 0 };
      }
      return { price, change: price - prevClose, changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0 };
    } catch { continue; }
  }
  return { price: 0, change: 0, changePercent: 0 };
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

// Twelve Data API - used for S&P 500, Nasdaq 100, and Gold
// SPY = S&P 500 ETF proxy, QQQ = Nasdaq 100 ETF proxy, XAU/USD = Gold spot (USD/oz)
// SPX/NDX indices require a paid plan; SPY/QQQ ETFs are available on the free plan
// All prices are in USD, converted to INR before returning
async function fetchTwelveDataQuotes(): Promise<{
  sp500: { price: number; change: number; changePercent: number };
  nasdaq100: { price: number; change: number; changePercent: number };
  gold: { price: number; change: number; changePercent: number };
}> {
  const zero = { price: 0, change: 0, changePercent: 0 };
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return { sp500: zero, nasdaq100: zero, gold: zero };

  try {
    const symbols = "SPY,QQQ,XAU/USD";
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { sp500: zero, nasdaq100: zero, gold: zero };

    const data = await res.json() as Record<string, any>;

    function parseQuote(q: any): { price: number; change: number; changePercent: number } {
      if (!q || q.status === "error" || q.code === 403 || !q.close) return zero;
      const price = parseFloat(q.close);
      const prevClose = parseFloat(q.previous_close ?? q.close);
      const change = price - prevClose;
      const changePercent = parseFloat(q.percent_change ?? "0");
      return { price, change, changePercent };
    }

    return {
      sp500: parseQuote(data["SPY"]),
      nasdaq100: parseQuote(data["QQQ"]),
      gold: parseQuote(data["XAU/USD"]),
    };
  } catch {
    return { sp500: zero, nasdaq100: zero, gold: zero };
  }
}

async function fetchAndCacheMarketPrices() {
  // Indian indices: Yahoo Finance v8 chart (works well for NSE)
  // Crypto: CoinGecko
  // S&P 500, Nasdaq 100, Gold: Twelve Data (falls back to Yahoo if key not set or fetch fails)
  const [nifty50, niftyIT, niftyBank, twelveData, btc, eth, sol] = await Promise.all([
    fetchYahooV8Chart("^NSEI"),
    fetchYahooV8Chart("^CNXIT"),
    fetchYahooV8Chart("^NSEBANK"),
    fetchTwelveDataQuotes(),
    fetchCryptoPrice("bitcoin"),
    fetchCryptoPrice("ethereum"),
    fetchCryptoPrice("solana"),
  ]);

  // Fall back to Yahoo Finance if Twelve Data returned zero prices
  const [sp500, nasdaq100, gold] = await Promise.all([
    twelveData.sp500.price > 0 ? Promise.resolve(twelveData.sp500) : fetchYahooV7Quote("SPY"),
    twelveData.nasdaq100.price > 0 ? Promise.resolve(twelveData.nasdaq100) : fetchYahooV7Quote("QQQ"),
    twelveData.gold.price > 0 ? Promise.resolve(twelveData.gold) : fetchYahooV7Quote("GC=F"),
  ]);

  // Apply ETF-to-index multipliers:
  // SPY (S&P 500 ETF) price * 10 ≈ S&P 500 index value
  // QQQ (Nasdaq 100 ETF) price * 40 ≈ Nasdaq 100 index value
  const sp500Adjusted = {
    price: sp500.price * 10,
    change: sp500.change * 10,
    changePercent: sp500.changePercent,
  };
  const nasdaq100Adjusted = {
    price: nasdaq100.price * 40,
    change: nasdaq100.change * 40,
    changePercent: nasdaq100.changePercent,
  };

  const fresh = [
    { key: "nifty50", label: "Nifty 50", ...nifty50 },
    { key: "niftyIT", label: "Nifty IT", ...niftyIT },
    { key: "niftyBank", label: "Nifty Bank", ...niftyBank },
    { key: "btc", label: "BTC", ...btc },
    { key: "eth", label: "ETH", ...eth },
    { key: "sol", label: "SOL", ...sol },
    { key: "sp500", label: "S&P 500", ...sp500Adjusted },
    { key: "nasdaq100", label: "Nasdaq 100", ...nasdaq100Adjusted },
    { key: "gold", label: "Gold", ...gold },
  ];

  // Get existing cached values to use as fallback for 0-price entries
  const cached = await db.select().from(priceCacheTable);
  const cacheMap: Record<string, typeof cached[0]> = {};
  for (const c of cached) cacheMap[c.key] = c;

  const entries = fresh.map(e => ({
    ...e,
    price: e.price > 0 ? e.price : (cacheMap[e.key]?.price ?? 0),
    change: e.price > 0 ? e.change : (cacheMap[e.key]?.change ?? 0),
    changePercent: e.price > 0 ? e.changePercent : (cacheMap[e.key]?.changePercent ?? 0),
  }));

  // Only cache entries with a valid price
  for (const entry of entries) {
    if (entry.price === 0) continue;
    try {
      await db.insert(priceCacheTable).values(entry).onConflictDoUpdate({
        target: priceCacheTable.key,
        set: { price: entry.price, change: entry.change, changePercent: entry.changePercent, label: entry.label, updatedAt: new Date() },
      });
    } catch (_err) {}
  }

  return entries;
}

let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000;

router.get("/", async (req, res) => {
  try {
    const now = Date.now();
    const forceRefresh = req.query.force === "true";
    let entries;

    if (forceRefresh || now - lastFetch > CACHE_TTL) {
      lastFetch = now;
      entries = await fetchAndCacheMarketPrices();
    } else {
      const cached = await db.select().from(priceCacheTable);
      if (cached.length >= 9) {
        entries = cached.map(c => ({ key: c.key, label: c.label, price: c.price, change: c.change, changePercent: c.changePercent }));
      } else {
        lastFetch = now;
        entries = await fetchAndCacheMarketPrices();
      }
    }

    const map: Record<string, { price: number; change: number; changePercent: number; label: string }> = {};
    for (const e of entries) map[e.key] = { price: e.price, change: e.change, changePercent: e.changePercent, label: e.label };

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
    BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
    DOGE: "dogecoin", XRP: "ripple", ADA: "cardano", AVAX: "avalanche-2",
    DOT: "polkadot", MATIC: "matic-network", LINK: "chainlink", LTC: "litecoin",
    UNI: "uniswap", SHIB: "shiba-inu", TRX: "tron", ATOM: "cosmos",
  };

  await Promise.all(
    symbols.map(async (symbol) => {
      const upperSym = symbol.toUpperCase();
      if (CRYPTO_SYMBOLS[upperSym]) {
        results.set(upperSym, await fetchCryptoPrice(CRYPTO_SYMBOLS[upperSym]));
      } else {
        const yahooSymbol = upperSym.endsWith(".NS") ? upperSym : `${upperSym}.NS`;
        const data = await fetchYahooV8Chart(yahooSymbol);
        if (data.price === 0) {
          const direct = await fetchYahooV8Chart(upperSym);
          results.set(upperSym, direct.price > 0 ? direct : await fetchYahooV7Quote(upperSym));
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
    const priceMap = await getHoldingCurrentPrices(holdings.map(h => h.symbol));
    const result = holdings.map(h => {
      const pd = priceMap.get(h.symbol.toUpperCase()) ?? { price: 0, change: 0, changePercent: 0 };
      return { symbol: h.symbol, price: pd.price, change: pd.change, changePercent: pd.changePercent };
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get holding prices");
    res.status(500).json({ error: "Failed to get holding prices" });
  }
});

export default router;
