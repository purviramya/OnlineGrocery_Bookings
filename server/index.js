// One process serves both the API and the React app.
//   dev:  Vite runs as middleware (hot reload), no separate frontend server.
//   prod: serves the pre-built files from dist/.
import './env.js';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toNodeHandler } from 'better-auth/node';
import { api } from './api.js';
import { auth, migrateAuth } from './auth.js';
import { initDb, pool } from './db.js';
import { APP } from '../shared/config.js';

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3000);
const root = fileURLToPath(new URL('..', import.meta.url));

await migrateAuth();
await initDb();

const app = express();
const server = http.createServer(app);
// Better Auth reads the raw body itself: mount it before any express.json().
app.all('/api/auth/{*any}', toNodeHandler(auth));
app.use('/api', api);

if (isProd) {
  const dist = path.join(root, 'dist');
  // Vite fingerprints files in /assets, so they can be cached forever.
  app.use('/assets', express.static(path.join(dist, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(dist, { index: false }));
  // Any other GET is a client-side route: hand it to React Router.
  app.get('/{*path}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  // hmr.server puts hot-reload on this same HTTP server, so Vite does not open a
  // second port (24678) that clashes when another dev server is running.
  const vite = await createServer({ root, server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  app.use(vite.middlewares);
}

server.listen(port, () => {
  console.log(`${APP.name} running at http://localhost:${port} (${isProd ? 'production' : 'development'})`);
});

// Let in-flight requests finish and close DB connections on deploy/restart.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => pool.end().then(() => process.exit(0))));
}
