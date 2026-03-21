# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── portfolio-tracker/  # React + Vite frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Portfolio Tracker App Features

- **Live Market Ticker Bar**: Nifty 50, Nifty IT, Nifty Bank, BTC, ETH, SOL, S&P 500, Nasdaq 100, Gold — prices in INR, auto-refreshes every hour
- **Portfolio Holdings**: Add stocks/crypto with symbol, name, type, quantity, buy price
- **Smart Averaging**: When adding more of an existing holding, the app auto-averages the buy price weighted by quantity
- **Notes**: Inline notes per holding row
- **Charts**: Line chart (historical performance with date range selector) + Pie chart (allocation)
- **Actions**: Add more, reduce, delete holdings
- **All values in Indian Rupees (₹)**
- **Dark mode modern minimal design with animations**

## API Routes

- `GET /api/holdings` — list all holdings
- `POST /api/holdings` — create holding
- `PATCH /api/holdings/:id` — update holding (add/reduce/update_note)
- `DELETE /api/holdings/:id` — delete holding
- `GET /api/prices` — market prices (Nifty, BTC, ETH, S&P, etc.)
- `GET /api/holdings/prices` — current prices for user holdings
- `GET /api/history?range=7d|1m|3m|6m|1y|all` — portfolio history
- `POST /api/history` — record portfolio snapshot

## Data Sources

- **Indian Indices & Stocks**: Yahoo Finance (^NSEI, ^CNXIT, ^NSEBANK, NSE:SYMBOL.NS)
- **Crypto (BTC, ETH, SOL, etc.)**: CoinGecko free API (INR prices)
- **S&P 500, Nasdaq, Gold**: Yahoo Finance (^GSPC, ^NDX, GC=F), USD converted to INR at 83.5

## DB Schema

- `holdings` — investment holdings
- `portfolio_history` — daily portfolio snapshots
- `price_cache` — cached market prices (refreshed every hour)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

### `artifacts/portfolio-tracker` (`@workspace/portfolio-tracker`)

React + Vite frontend for the portfolio tracker. Uses:
- `recharts` for charts
- `framer-motion` for animations
- `react-hook-form` + `@hookform/resolvers` for forms
- `@workspace/api-client-react` for generated React Query hooks

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `pnpm --filter @workspace/db run push` — push schema changes
- `pnpm --filter @workspace/db run push-force` — force push
