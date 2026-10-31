// Better Auth: the single place that owns users, sessions and sign-in methods.
// Email+password is always on; Facebook and Instagram switch on when their
// credentials are present in the environment (Google, Facebook, Instagram) (the UI asks /api/providers).
import { betterAuth } from 'better-auth';
import { genericOAuth } from 'better-auth/plugins';
import { getMigrations } from 'better-auth/db/migration';
import { pool } from './db.js';

const { BETTER_AUTH_SECRET } = process.env;
// On Render, RENDER_EXTERNAL_URL is the service's public https origin.
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
if (!BETTER_AUTH_SECRET) {
  console.error('BETTER_AUTH_SECRET is not set. Generate one with: openssl rand -base64 32');
  process.exit(1);
}

const env = process.env;
export const providers = {
  email: true,
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  facebook: Boolean(env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET),
  instagram: Boolean(env.INSTAGRAM_CLIENT_ID && env.INSTAGRAM_CLIENT_SECRET),
};

// Instagram has no built-in provider, so it goes through the generic OAuth plugin.
// It uses "Instagram API with Instagram Login" (Meta app → Instagram product).
// Instagram never returns an email, so we synthesise a unique, non-deliverable one;
// the user can be linked to a real account later. Personal accounts are not supported
// by Meta's current API (only Business/Creator accounts) – tell the user.
const instagram = {
  providerId: 'instagram',
  clientId: env.INSTAGRAM_CLIENT_ID,
  clientSecret: env.INSTAGRAM_CLIENT_SECRET,
  authorizationUrl: 'https://www.instagram.com/oauth/authorize',
  tokenUrl: 'https://api.instagram.com/oauth/access_token',
  scopes: ['instagram_business_basic'],
  pkce: false,
  getUserInfo: async (tokens) => {
    const res = await fetch(`https://graph.instagram.com/me?fields=user_id,username,name&access_token=${tokens.accessToken}`);
    if (!res.ok) return null;
    const p = await res.json();
    const id = String(p.user_id ?? p.id);
    return { id, name: p.name || p.username, email: `instagram-${id}@users.invalid`, emailVerified: false };
  },
};

export const auth = betterAuth({
  database: pool, // the same Neon pool as the app
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL,
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  socialProviders: {
    ...(providers.google && { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }),
    ...(providers.facebook && { facebook: { clientId: env.FACEBOOK_CLIENT_ID, clientSecret: env.FACEBOOK_CLIENT_SECRET } }),
  },
  plugins: providers.instagram ? [genericOAuth({ config: [instagram] })] : [],
  // Same verified email from two providers → one account.
  account: { accountLinking: { enabled: true, trustedProviders: ['google', 'facebook', 'email-password'] } },
});

// Creates/updates Better Auth's tables (user, session, account, verification).
// Must run before initDb(), because orders.user_id and loyalty_accounts.user_id references "user".
export async function migrateAuth() {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}
