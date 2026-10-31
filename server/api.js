import express, { Router } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth, providers } from './auth.js';
import * as db from './db.js';
import { HttpError } from './errors.js';
import { validateDelivery, validateItems } from '../shared/validation.js';

export const api = Router();
api.use(express.json());

// Browsing is public; buying and anything about "my orders"/points needs a Better Auth session.
// Ownership always comes from the session, never from the request body.
async function requireUser(req, res, next) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw new HttpError(401, 'Please sign in');
  req.user = session.user;
  next();
}

api.get('/health', async (req, res) => {
  await db.pool.query('SELECT 1');
  res.json({ ok: true });
});

// Which sign-in buttons the UI should show.
api.get('/providers', (req, res) => res.json(providers));

api.get('/categories', async (req, res) => {
  res.json(await db.listCategories());
});

api.get('/products', async (req, res) => {
  res.json(await db.listProducts({ category: req.query.category, q: req.query.q }));
});

api.get('/products/:id', async (req, res) => {
  const product = await db.getProduct(req.params.id);
  if (!product) throw new HttpError(404, 'Not found');
  res.json(product);
});

// Points balance + recent earn/redeem history for the signed-in user.
api.get('/loyalty', requireUser, async (req, res) => {
  res.json(await db.getLoyalty(req.user.id));
});

api.get('/orders', requireUser, async (req, res) => {
  res.json(await db.listOrders(req.user.id));
});

api.get('/orders/:id', requireUser, async (req, res) => {
  const order = await db.getOrder(req.user.id, req.params.id);
  if (!order) throw new HttpError(404, 'Order not found');
  res.json(order);
});

// Login is required to buy. Prices, stock, delivery, points value and points earned are all
// decided here from DB rows; the client only says which products, how many, and how many points.
api.post('/orders', requireUser, async (req, res) => {
  const { items, redeemPoints = 0, customer } = req.body ?? {};

  const itemsError = validateItems(items);
  if (itemsError) throw new HttpError(400, itemsError);
  const fieldErrors = validateDelivery(customer);
  if (Object.keys(fieldErrors).length) throw new HttpError(400, 'Invalid details', fieldErrors);

  const c = Object.fromEntries(Object.entries(customer).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
  const order = await db.createOrder({
    userId: req.user.id,
    items: items.map(({ productId, qty }) => ({ productId, qty })),
    redeemPoints,
    customer: { name: c.name, email: c.email, phone: c.phone, address: c.address, city: c.city, postcode: c.postcode.toUpperCase(), notes: c.notes ?? '' },
  });
  res.status(201).json(order);
});

api.use((req, res) => res.status(404).json({ error: `No such endpoint: ${req.method} /api${req.path}` }));

// eslint-disable-next-line no-unused-vars
api.use((err, req, res, next) => {
  const status = err.status ?? (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message, details: err.details });
});
