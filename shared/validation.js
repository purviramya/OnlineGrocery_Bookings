import { MAX_QTY_PER_LINE } from './config.js';

// Sign-up / sign-in rules (Better Auth enforces the same minimum on the server).
export function validateCredentials(f = {}, { signUp = false } = {}) {
  const s = (v) => (typeof v === 'string' ? v : '');
  const e = {};
  if (signUp && !s(f.name).trim()) e.name = 'Required';
  if (!/^\S+@\S+\.\S+$/.test(s(f.email))) e.email = 'Enter a valid email';
  if (s(f.password).length < 8) e.password = 'At least 8 characters';
  return e;
}

// Delivery details, shared so the server enforces exactly what the UI checks.
export function validateDelivery(f = {}) {
  const s = (v) => (typeof v === 'string' ? v.trim() : '');
  const e = {};
  if (!s(f.name)) e.name = 'Required';
  if (!/^\S+@\S+\.\S+$/.test(s(f.email))) e.email = 'Enter a valid email';
  if (!/^[+\d][\d\s()-]{6,19}$/.test(s(f.phone))) e.phone = 'Enter a valid phone number';
  if (!s(f.address)) e.address = 'Required';
  if (!s(f.city)) e.city = 'Required';
  if (!/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/.test(s(f.postcode))) e.postcode = 'Enter a valid UK postcode';
  if (s(f.notes).length > 300) e.notes = 'Keep notes under 300 characters';
  return e;
}

// Cart lines as sent to the API: [{ productId, qty }].
export function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) return 'Your basket is empty';
  const seen = new Set();
  for (const it of items) {
    if (typeof it?.productId !== 'string' || seen.has(it.productId)) return 'Invalid basket';
    seen.add(it.productId);
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > MAX_QTY_PER_LINE)
      return `Quantity must be between 1 and ${MAX_QTY_PER_LINE}`;
  }
  return null;
}
