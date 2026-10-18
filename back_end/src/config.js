import 'dotenv/config';
import fs from 'node:fs';

function parseConnection() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'defaultdb',
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'defaultdb',
  };
}

function buildSsl() {
  if (String(process.env.DB_SSL).toLowerCase() === 'false') return undefined;
  const pem = process.env.DB_SSL_CA_PEM?.replace(/\\n/g, '\n');
  if (pem) return { ca: pem, rejectUnauthorized: true };
  const caPath = process.env.DB_SSL_CA;
  if (caPath && fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
  }
  console.warn(
    '[db] No Aiven CA certificate provided (DB_SSL_CA / DB_SSL_CA_PEM). ' +
      'Connecting over TLS WITHOUT verifying the server certificate.'
  );
  return { rejectUnauthorized: false };
}

export const config = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  taxRate: 0.08,
  db: {
    ...parseConnection(),
    ssl: buildSsl(),
    // Serverless instances multiply, so keep the per-instance pool small on Vercel (Aiven caps total connections).
    connectionLimit: Number(process.env.DB_POOL_SIZE || (process.env.VERCEL ? 3 : 5)),
  },
};
