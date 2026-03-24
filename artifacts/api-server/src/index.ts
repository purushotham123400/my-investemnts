import app from "./app";
import { logger } from "./lib/logger";
import { startAlertChecker } from "./jobs/alertChecker";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

// Auto-create new tables in production DB (safe: uses IF NOT EXISTS)
async function ensureTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deleted_holdings (
        id SERIAL PRIMARY KEY,
        original_id INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'stock',
        quantity DOUBLE PRECISION NOT NULL,
        avg_buy_price DOUBLE PRECISION NOT NULL,
        note TEXT,
        deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        original_created_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS holding_day_prices (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        date TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    logger.info("DB tables ensured");
  } catch (err) {
    logger.error({ err }, "Failed to ensure tables - bin/day-prices may not work");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  await ensureTables();
  startAlertChecker();
});
