import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  queueLimit: 0,
  timezone: 'Z', // all DATETIME values are stored/read as UTC
  decimalNumbers: true, // DECIMAL -> JS number instead of string
  enableKeepAlive: true,
  idleTimeout: 30000, // release idle connections so frozen serverless instances don't hold DB slots
  dateStrings: false,
});

/** Run fn inside a transaction; commits on success, rolls back on any throw. */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    // READ COMMITTED + row locks on the slot => correct serialisation without gap-lock deadlocks
    await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
}
