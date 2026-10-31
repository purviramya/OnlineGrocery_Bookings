// Load .env into process.env if present (real env vars take precedence).
// Done in code rather than with `node --env-file`, because combining that flag
// with --watch makes Node watch the whole project, including Vite's cache.
try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}
