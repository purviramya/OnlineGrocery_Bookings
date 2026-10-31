// Postgres (Neon) data access. Uses the Neon serverless driver's Pool, which
// speaks the node-postgres API over WebSockets and supports transactions.
import { Pool } from '@neondatabase/serverless';
import { products as seed } from './seed.js';
import { calcOrder } from '../shared/pricing.js';
import { HttpError } from './errors.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string.');
  process.exit(1);
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Money is integer pence and loyalty is integer points, so there is nothing to parse.
// Stock and points can never go negative: the CHECKs are the last line of defence behind
// the conditional UPDATEs / row lock in createOrder.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS products (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    unit        text NOT NULL DEFAULT '',
    category    text NOT NULL,
    price_pence integer NOT NULL CHECK (price_pence >= 0),
    stock       integer NOT NULL CHECK (stock >= 0),
    emoji       text NOT NULL DEFAULT '',
    color       text NOT NULL DEFAULT '#eeeeee',
    description text NOT NULL DEFAULT '',
    active      boolean NOT NULL DEFAULT true,
    sort_order  integer NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS loyalty_accounts (
    user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    points  integer NOT NULL DEFAULT 0 CHECK (points >= 0)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id              text PRIMARY KEY,
    user_id         text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'placed' CHECK (status IN ('placed')),
    customer        jsonb NOT NULL,
    items           jsonb NOT NULL,
    subtotal_pence  integer NOT NULL,
    delivery_pence  integer NOT NULL,
    points_redeemed integer NOT NULL DEFAULT 0,
    discount_pence  integer NOT NULL DEFAULT 0,
    total_pence     integer NOT NULL CHECK (total_pence >= 0),
    points_earned   integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders (user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS loyalty_ledger (
    id         bigserial PRIMARY KEY,
    user_id    text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    order_id   text NOT NULL,
    delta      integer NOT NULL,
    reason     text NOT NULL CHECK (reason IN ('earn', 'redeem')),
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS loyalty_ledger_user_idx ON loyalty_ledger (user_id, id DESC);
`;

// Creates tables if missing and seeds the catalogue into an empty products table.
export async function initDb() {
  await pool.query(SCHEMA);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM products');
  if (rows[0].n > 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [i, p] of seed.entries()) {
      await client.query(
        `INSERT INTO products (id, name, unit, category, price_pence, stock, emoji, color, description, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.unit, p.category, p.pricePence, p.stock, p.emoji, p.color, p.description, i]
      );
    }
    await client.query('COMMIT');
    console.log(`Seeded ${seed.length} products`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------- Products ----------

// DB rows → the camelCase shape the React app uses.
const toProduct = (r) => ({
  id: r.id, name: r.name, unit: r.unit, category: r.category, pricePence: r.price_pence,
  stock: r.stock, emoji: r.emoji, color: r.color, description: r.description,
});

export async function listProducts({ category, q } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM products
     WHERE active AND ($1::text IS NULL OR category = $1) AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%')
     ORDER BY sort_order, id`,
    [category || null, q || null]
  );
  return rows.map(toProduct);
}

export async function getProduct(id) {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1 AND active', [id]);
  return rows[0] ? toProduct(rows[0]) : null;
}

export async function listCategories() {
  const { rows } = await pool.query('SELECT DISTINCT category FROM products WHERE active ORDER BY category');
  return rows.map((r) => r.category);
}

// ---------- Loyalty ----------

export async function getLoyalty(userId) {
  const [acct, ledger] = await Promise.all([
    pool.query('SELECT points FROM loyalty_accounts WHERE user_id = $1', [userId]),
    pool.query('SELECT order_id, delta, reason, created_at FROM loyalty_ledger WHERE user_id = $1 ORDER BY id DESC LIMIT 20', [userId]),
  ]);
  return {
    points: acct.rows[0]?.points ?? 0,
    history: ledger.rows.map((r) => ({ orderId: r.order_id, delta: r.delta, reason: r.reason, createdAt: r.created_at })),
  };
}

// ---------- Orders ----------

const toOrder = (r) => ({
  id: r.id,
  status: r.status,
  customer: r.customer,
  items: r.items,
  totals: {
    subtotal: r.subtotal_pence, delivery: r.delivery_pence, discount: r.discount_pence, total: r.total_pence,
    pointsRedeemed: r.points_redeemed, pointsEarned: r.points_earned,
  },
  createdAt: r.created_at,
});

export async function listOrders(userId) {
  const { rows } = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return rows.map(toOrder);
}

export async function getOrder(userId, id) {
  const { rows } = await pool.query('SELECT * FROM orders WHERE user_id = $1 AND id = $2', [userId, id]);
  return rows[0] ? toOrder(rows[0]) : null;
}

// One transaction: price from DB rows, conditional stock decrement (409 if short), lock the
// user's loyalty row so concurrent orders can't spend the same points twice, then record the
// order, the redemption and the points earned on what was actually paid.
export async function createOrder({ userId, items, redeemPoints, customer }) {
  const sorted = [...items].sort((a, b) => (a.productId < b.productId ? -1 : 1)); // fixed lock order
  const ids = sorted.map((i) => i.productId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: found } = await client.query('SELECT * FROM products WHERE id = ANY($1) AND active ORDER BY id', [ids]);
    if (found.length !== ids.length) throw new HttpError(400, 'One of the products in your basket is no longer available');

    const lines = sorted.map((it, i) => ({ ...toProduct(found[i]), qty: it.qty }));
    for (const l of lines) {
      const upd = await client.query('UPDATE products SET stock = stock - $2 WHERE id = $1 AND stock >= $2', [l.id, l.qty]);
      if (upd.rowCount === 0) throw new HttpError(409, `Sorry, we don't have ${l.qty} × ${l.name} in stock`);
    }

    await client.query('INSERT INTO loyalty_accounts (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
    const { rows: acct } = await client.query('SELECT points FROM loyalty_accounts WHERE user_id = $1 FOR UPDATE', [userId]);
    const t = calcOrder({ lines, redeemPoints, balance: acct[0].points });
    if (t.redeemError) throw new HttpError(400, 'Invalid details', { redeemPoints: t.redeemError });

    await client.query('UPDATE loyalty_accounts SET points = points - $2 + $3 WHERE user_id = $1', [userId, t.redeemed, t.earned]);

    const id = 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
    const snapshot = lines.map((l) => ({ productId: l.id, name: l.name, unit: l.unit, emoji: l.emoji, pricePence: l.pricePence, qty: l.qty }));
    await client.query(
      `INSERT INTO orders (id, user_id, customer, items, subtotal_pence, delivery_pence, points_redeemed, discount_pence, total_pence, points_earned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, userId, customer, JSON.stringify(snapshot), t.subtotal, t.delivery, t.redeemed, t.discount, t.total, t.earned]
    );
    if (t.redeemed > 0) await client.query(`INSERT INTO loyalty_ledger (user_id, order_id, delta, reason) VALUES ($1, $2, $3, 'redeem')`, [userId, id, -t.redeemed]);
    if (t.earned > 0) await client.query(`INSERT INTO loyalty_ledger (user_id, order_id, delta, reason) VALUES ($1, $2, $3, 'earn')`, [userId, id, t.earned]);

    await client.query('COMMIT');
    return getOrder(userId, id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
