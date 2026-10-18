import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../src/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(here, '../sql/schema.sql'), 'utf8');

const conn = await mysql.createConnection({ ...config.db, multipleStatements: true });
try {
  if (process.argv.includes('--reset')) {
    console.log('[migrate] dropping existing ParkFlow tables…');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('DROP VIEW IF EXISTS v_parking_session');
    for (const t of ['payment', 'parking_session', 'booking', 'two_wheeler', 'four_wheeler', 'heavy_vehicle', 'vehicle',
      'users', 'standard_slot', 'accessible_slot', 'parking_slot', 'parking_lot', 'tariff']) {
      await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  }
  await conn.query(sql);
  console.log('[migrate] schema is up to date.');
} finally {
  await conn.end();
}
