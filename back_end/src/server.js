import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const app = createApp();

pool
  .query('SELECT VERSION() AS v')
  .then(([[row]]) => console.log(`[db] connected to MySQL ${row.v} at ${config.db.host}:${config.db.port}/${config.db.database}`))
  .catch((e) => console.error('[db] connection FAILED:', e.code || e.message));

const server = app.listen(config.port, () => console.log(`[api] ParkFlow backend listening on :${config.port}`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => pool.end().then(() => process.exit(0))));
}
