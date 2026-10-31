// Drops all tables (including users and sessions) and re-seeds the catalog. Usage: npm run db:reset
import './env.js';
import { pool, initDb } from './db.js';
import { migrateAuth } from './auth.js';

await pool.query('DROP TABLE IF EXISTS loyalty_ledger, loyalty_accounts, orders, products, session, account, verification, "user" CASCADE');
await migrateAuth();
await initDb();
await pool.end();
console.log('Database reset.');
