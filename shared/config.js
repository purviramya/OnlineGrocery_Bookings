// Single source of truth for wording, locale and the shop/loyalty rules.
// Imported by both the browser and the server.
export const APP = {
  name: 'FreshBasket',
  emoji: '🛒',
  locale: 'en-GB',
  currency: 'GBP',
  timezone: 'Europe/London', // order times are stored as UTC and shown in this zone
};

// All money is integer pence so loyalty maths never meets floating point.
export const DELIVERY = {
  feePence: 350,
  freeOverPence: 4000, // groceries subtotal at or above this ships free
};

export const LOYALTY = {
  pointsPerPound: 1, // earned on the amount actually paid, whole pounds only
  penceValue: 1, // one point is worth 1p when redeemed
  minBalanceToRedeem: 100, // points can only be spent once the balance reaches this
};

export const MAX_QTY_PER_LINE = 20;
