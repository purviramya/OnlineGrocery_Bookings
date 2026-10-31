import { DELIVERY, LOYALTY } from './config.js';

// Used by the browser (preview) and the server (authoritative, from DB prices and DB balance).
// `lines`: [{ pricePence, qty }]. Returns integer pence/points; never throws on bad redeem
// input, it reports `redeemError` so callers can show or reject it.
export function calcOrder({ lines, redeemPoints = 0, balance = 0 }) {
  const subtotal = lines.reduce((sum, l) => sum + l.pricePence * l.qty, 0);
  const delivery = subtotal === 0 || subtotal >= DELIVERY.freeOverPence ? 0 : DELIVERY.feePence;
  const gross = subtotal + delivery;

  const points = Number.isInteger(redeemPoints) ? redeemPoints : NaN;
  let redeemError = null;
  if (!(points >= 0)) redeemError = 'Points must be a whole number';
  else if (points > 0 && balance < LOYALTY.minBalanceToRedeem)
    redeemError = `You can spend points once you have ${LOYALTY.minBalanceToRedeem}`;
  else if (points > balance) redeemError = 'You do not have that many points';
  else if (points * LOYALTY.penceValue > gross) redeemError = 'Points are worth more than this order';

  const redeemed = redeemError ? 0 : points;
  const discount = redeemed * LOYALTY.penceValue;
  const total = gross - discount;
  const earned = Math.floor(total / 100) * LOYALTY.pointsPerPound;
  const maxRedeem = balance >= LOYALTY.minBalanceToRedeem ? Math.min(balance, Math.floor(gross / LOYALTY.penceValue)) : 0;
  return { subtotal, delivery, discount, redeemed, total, earned, maxRedeem, redeemError };
}
