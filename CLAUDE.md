# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node ≥ 22 is required (installed via nvm; in a fresh shell run `source ~/.nvm/nvm.sh` if `node` is not found).

```bash
npm run dev        # single process on :3000 – Express API + Vite middleware (HMR); restarts on server/ or shared/ changes
npm run build      # vite build → dist/
npm start          # NODE_ENV=production: Express serves dist/ + /api
npm run db:reset   # DROP all tables incl. users/sessions, recreate schema, re-seed
```

There is no test suite or linter configured. Verify API changes with curl against the running dev server (see README "Testing the API"); loyalty/orders endpoints need a Better Auth session cookie (sign up with curl and `-c jar`, see README).

`DATABASE_URL` (Neon **pooled** connection string) must be set, via `.env` or the real environment; the server exits on startup without it. `.env` is gitignored and holds a live credential – never print or commit it.

## Architecture

Deployed as **one artifact / one process**: `server/index.js` mounts `/api` and then either Vite in middleware mode (dev) or static `dist/` with an SPA fallback to `index.html` (prod). There is no separate frontend server and no proxy; the client calls `/api/...` on the same origin. Keep it that way.

**Three code roots:**
- `src/` – React 18 SPA (react-router v6). All server calls go through `src/services/api.js`; components never call `fetch` directly.
- `server/` – Express 5 (async handlers may `throw`; errors are caught by the router's error middleware in `server/api.js` and returned as `{ error, details }`). Throw `HttpError(status, message, details)` from `server/errors.js` for client errors.
- `shared/` – plain ESM imported by **both** browser and server (`config.js` wording/locale/delivery/loyalty rules, `pricing.js` `calcOrder`, `validation.js`). Change business rules here so UI and server agree; no Node- or browser-only APIs.

**Data (Neon Postgres via `@neondatabase/serverless` `Pool`):** everything lives in `server/db.js` – schema (`CREATE TABLE IF NOT EXISTS`, run by `initDb()` on every startup), seeding from `server/seed.js` when `products` is empty, and all queries. There are no migrations: changing a column requires an `ALTER` or `npm run db:reset`. Money is **integer pence** everywhere (`price_pence`, `money(pence)` in the UI), so there is no NUMERIC parsing. DB rows are mapped to the camelCase shape the React app expects (`toProduct`, `toOrder`) – preserve those response shapes.

**Order integrity and loyalty:** `createOrder` (`server/db.js`) is one transaction: price from DB rows, conditional `UPDATE products SET stock = stock - n WHERE stock >= n` per line in id order (miss → 409 + rollback), then `SELECT … FROM loyalty_accounts … FOR UPDATE` so concurrent orders by one user serialise, `calcOrder` with the locked balance, and the order, balance update and `loyalty_ledger` rows. Rule: earn `floor(paid £) × pointsPerPound` on the amount paid after redemption; redeem only when balance ≥ 100, 1 point = 1p, never more than the order gross. The UI previews with the same `calcOrder`; the server ignores client prices/totals. Cancelling orders is intentionally not built (it would need a points reversal).

**Auth (Better Auth):** `server/auth.js` is the only config. Email+password is always on; Google and Facebook (built-in providers) and Instagram (`genericOAuth` plugin, no built-in provider) activate when their env vars exist, and `/api/providers` tells the UI which buttons to show. Every method hits the same handler mounted in `server/index.js` (`/api/auth/{*any}`, **before** `express.json()`) and the same tables. `migrateAuth()` creates Better Auth's `user/session/account/verification` tables and must run before `initDb()` because `orders.user_id` and `loyalty_accounts.user_id` reference `"user"`. `requireUser` in `server/api.js` derives ownership from the session; never read a user id from the request. Browser side: `src/services/auth-client.js` (`authClient.useSession()`, `signIn.social`), `RequireAuth`, `AuthPage`.

**Client state split:** the basket (`[{productId, qty}]` only) and saved delivery details are in `localStorage` (keys prefixed `freshbasket:`); `ShopContext` joins the basket with the live catalogue and holds the loyalty balance. Orders, points and sessions are server-side.

Order times are stored as UTC and shown in `APP.timezone`; currency/locale come from `shared/config.js` via `money()` in `AppContext.jsx`.

## Gotchas

- Better Auth rejects non-GET requests without an `Origin` matching `BETTER_AUTH_URL`; add `-H "Origin: http://localhost:3000"` to curl. `BETTER_AUTH_URL` must equal the origin users actually visit, or OAuth callbacks/cookies fail.
- Instagram returns no email; the stored one is a `@users.invalid` placeholder, and only Business/Creator accounts can log in.

- `.env` is loaded in code by `server/env.js` (`process.loadEnvFile`), which must be the first import in each entry point (`server/index.js`, `server/db-reset.js`). Do **not** switch to `node --env-file`: combined with `--watch-path` it makes Node watch the whole project, and Vite's writes to `node_modules/.vite` cause an endless restart loop.
- In Express 5, wildcard routes need named params (`'/{*path}'`), not `'*'`.
