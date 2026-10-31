# FreshBasket – React + Vite + Express + Neon Postgres

One Node.js process serves both the React app and the `/api` endpoints, so there is
a single thing to run and deploy.

## Run

```bash
npm install
cp .env.example .env     # paste your Neon connection string into DATABASE_URL and set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run dev              # http://localhost:3000 – API + React with hot reload
npm run db:reset         # drop all tables and re-seed (destroys all orders, points and users)
```

Tables are created and the 24-item grocery catalogue is seeded automatically on first start.

## Deploy to Render
`render.yaml` defines the service; `.github/workflows/ci.yml` builds every push/PR. Render auto-deploys `main`.
- **Automated** (from the build skill): `GITHUB_TOKEN=… RENDER_API_KEY=… node ~/.claude/skills/build-fullstack-app-react-node/scripts/deploy-render.mjs . --repo OWNER/NAME --region <near-your-neon>` creates the repo, pushes, creates/updates the Render service and smoke-tests the live URL. Re-run it to ship changes or add env vars from `.env`.
- **Manual:** push to GitHub, Render → New → Blueprint → select the repo → paste `DATABASE_URL` (Neon pooled URL); `BETTER_AUTH_SECRET` is generated and the public URL is picked up from `RENDER_EXTERNAL_URL`.
After deploying, register `https://<service>.onrender.com/api/auth/callback/<google|facebook|instagram>` in each provider's console and add its client ID/secret in Render → Environment.
The free plan sleeps when idle (first request after a pause takes ~30–60 s); use Starter to avoid that.

## Deploy elsewhere (single artifact)

```bash
npm ci
npm run build            # builds the React app into dist/
npm start                # NODE_ENV=production, serves dist/ + /api on $PORT
```

Or build the included `Dockerfile`. Set these on the host:

| Variable       | Required | Purpose                                                      |
|----------------|----------|--------------------------------------------------------------|
| `DATABASE_URL` | yes      | Neon **pooled** connection string (host contains `-pooler`)  |
| `PORT`         | no       | HTTP port, default `3000` (most hosts inject this)           |
| `BETTER_AUTH_SECRET` | yes | Signs sessions/cookies: `openssl rand -base64 32`            |
| `BETTER_AUTH_URL`    | yes | Public origin, e.g. `https://myapp.onrender.com` (OAuth callbacks are built from it) |
| `GOOGLE_CLIENT_ID` / `_SECRET`     | no | Enables "Continue with Google" (Gmail)  |
| `FACEBOOK_CLIENT_ID` / `_SECRET`   | no | Enables "Continue with Facebook"        |
| `INSTAGRAM_CLIENT_ID` / `_SECRET`  | no | Enables "Continue with Instagram"       |

`GET /api/health` returns `{ "ok": true }` once the database is reachable (use it as the health check).
The server is stateless, so several instances can share one database.

## How it works
- **Dev:** Express mounts Vite as middleware (hot reload, no second server); `node --watch` restarts on `server/` or `shared/` changes.
- **Prod:** Express serves `dist/` and falls back to `index.html` for client-side routes.
- **No overselling:** stock is decremented with `UPDATE products SET stock = stock - n WHERE id = $1 AND stock >= n` inside the order transaction; a miss returns 409 and rolls everything back.
- **Loyalty:** 1 point per whole £1 *paid* (after any points discount; delivery included). Points can be spent only while the balance is ≥ 100; 1 point = 1p, up to the order total. The rules live in `shared/config.js` (`LOYALTY`) and `shared/pricing.js` (`calcOrder`), used by the UI preview and the server. The server locks the user's `loyalty_accounts` row (`FOR UPDATE`) so two concurrent orders cannot spend the same points; `loyalty_ledger` records every earn/redeem.
- **Trust:** the client sends only product ids, quantities and points to spend. Prices, delivery (£3.50, free from £40), discount and points earned are computed on the server from DB rows. Money is integer pence.
- **Login before purchase:** browsing and the basket are public (basket in `localStorage`); `/checkout`, orders and points need a session.
- **Auth (Better Auth):** email + password always; Google, Facebook and Instagram when their env vars are set. All three use the same
  `/api/auth/*` handler and the same `user`/`session`/`account` tables in Neon. Browsing is public; checkout needs a session cookie.
- **Browser storage:** the basket and saved delivery details live in `localStorage`.

## Social sign-in setup
Replace the origin in production.
- Google (Gmail accounts): console.cloud.google.com → APIs & Services → Credentials → OAuth client ID (Web application); add authorised redirect URI `http://localhost:3000/api/auth/callback/google`. Configure the OAuth consent screen first; in "Testing" mode only listed test users can sign in.
- Facebook/Instagram: register an app at developers.facebook.com and add the redirect URIs:
- Facebook: `http://localhost:3000/api/auth/callback/facebook` (Facebook Login product)
- Instagram: `http://localhost:3000/api/auth/callback/instagram` ("Instagram API with Instagram Login" product).
  Meta only supports Business/Creator Instagram accounts, and Instagram returns no email (a placeholder
  `instagram-<id>@users.invalid` is stored). Until the Meta app is approved only listed testers can sign in.

## Testing the API
Orders and points belong to the signed-in user, so a bare `curl` to `/api/orders` returns 401. Sign up with curl and keep the cookie
(`-H Origin` is required by Better Auth's CSRF check):

```bash
O=http://localhost:3000
curl -c jar -H "Origin: $O" -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@example.com","password":"password123"}' $O/api/auth/sign-up/email
curl localhost:3000/api/health
curl localhost:3000/api/products
curl "localhost:3000/api/products?category=Bakery&q=sour"
curl -b jar localhost:3000/api/loyalty
curl -b jar -H "Origin: $O" -H 'Content-Type: application/json' -d '{"items":[{"productId":"milk","qty":2}],"redeemPoints":0,"customer":{"name":"Test","email":"test@example.com","phone":"07700900123","address":"1 High St","city":"London","postcode":"SW1A 1AA"}}' $O/api/orders
Once signed in in the browser, `http://localhost:3000/api/orders` also works from the address bar (the cookie is sent).

## API
| Method | Path                                  | Notes                                                        |
|--------|---------------------------------------|--------------------------------------------------------------|
| GET    | `/api/health`                         | DB reachability                                              |
| GET    | `/api/categories`                     |                                                              |
| GET    | `/api/products[?category=X&q=text]`   | Catalogue with live `stock`                                  |
| GET    | `/api/products/:id`                   | 404 if unknown                                               |
| GET    | `/api/providers`                      | Which sign-in methods are enabled                            |
| ANY    | `/api/auth/*`                         | Better Auth (sign-up/in/out, session, OAuth callbacks)       |
| GET    | `/api/loyalty`                        | `{ points, history[] }`; 401 without a session               |
| GET    | `/api/orders`, `/api/orders/:id`      | Signed-in user's own orders; 404 for someone else's          |
| POST   | `/api/orders`                         | `{ items:[{productId,qty}], redeemPoints, customer }` → 201; 400 invalid (incl. points rules), 409 out of stock |

## Structure
```
server/   index.js (entry) · api.js (routes) · auth.js (Better Auth) · db.js (schema + queries) · seed.js · env.js · errors.js · db-reset.js
shared/   config.js (wording, delivery, loyalty rules) · pricing.js (calcOrder) · validation.js   (browser + server)
src/      React app; services/api.js is the only place that calls fetch
```

## Next steps
- Auth extras: email verification / password reset (needs an email sender), roles/admin.
- Payments (cards/Stripe), order status updates and cancellation (would need a points reversal), admin UI for stock and prices, email receipts.
- Migrations: schema uses `CREATE TABLE IF NOT EXISTS`; adopt a migration tool once the schema changes.
