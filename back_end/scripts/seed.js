/**
 * Seeds the reference data the frontend expects:
 *   - 1 parking lot, 30 slots on 3 floors (same layout as the original UI)
 *   - tariffs (car ₹50/h, two-wheeler ₹20/h, heavy ₹120/h)
 *   - the "Walk-in Guest" owner used for gate entries without an account
 * Run with --demo to also load the sample vehicles/reservation/receipt the
 * frontend used to hard-code.
 */
import { pool, withTransaction } from '../src/db.js';
import { insertSlot } from '../src/services.js';

const demo = process.argv.includes('--demo');
const LAYOUT = [
  { floor: 1, rows: ['A', 'B'] },
  { floor: 2, rows: ['C', 'D'] },
  { floor: 3, rows: ['E', 'F'] },
];
const ACCESSIBLE = new Set(['A1', 'C1', 'E1']); // demonstrates the EER AccessibleSlot subclass

await withTransaction(async (conn) => {
  const [lots] = await conn.query('SELECT lot_id FROM parking_lot ORDER BY lot_id LIMIT 1');
  let lot = lots[0];
  if (!lot) {
    const [r] = await conn.query('INSERT INTO parking_lot (lot_name, location) VALUES (?, ?)', [
      'ParkFlow Main Lot',
      'Main building – 3-floor parking structure',
    ]);
    lot = { lot_id: r.insertId };
    console.log('[seed] created parking lot', lot.lot_id);
  }

  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM parking_slot WHERE lot_id = ?', [lot.lot_id]);
  if (n === 0) {
    for (const { floor, rows } of LAYOUT) {
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < 5; c++) {
          const slotNumber = `${rows[r]}${c + 1}`;
          await insertSlot(conn, {
            lotId: lot.lot_id,
            slotNumber,
            slotType: ACCESSIBLE.has(slotNumber) ? 'accessible' : 'standard',
            vehicleCategory: c === 4 ? 'two_wheeler' : 'four_wheeler',
            floorNo: floor,
            row: r,
            col: c,
          });
        }
      }
    }
    console.log('[seed] created 30 slots');
  } else {
    console.log(`[seed] slots already present (${n}), skipping`);
  }

  for (const [type, rate] of [['four_wheeler', 50], ['two_wheeler', 20], ['heavy_vehicle', 120]]) {
    await conn.query('INSERT IGNORE INTO tariff (vehicle_type, hourly_rate) VALUES (?, ?)', [type, rate]);
  }
  await conn.query(
    "INSERT IGNORE INTO users (name, email, phone) VALUES ('Walk-in Guest', 'walk-in@parkflow.local', NULL)"
  );

  if (demo) await seedDemo(conn, lot.lot_id);
});

async function seedDemo(conn, lotId) {
  const [[{ c }]] = await conn.query('SELECT COUNT(*) AS c FROM vehicle');
  if (c > 0) return console.log('[seed] demo data skipped (vehicles already exist)');
  const now = Date.now();
  const min = 60 * 1000;
  const slotId = async (num) => (await conn.query('SELECT slot_id FROM parking_slot WHERE lot_id=? AND slot_number=?', [lotId, num]))[0][0].slot_id;
  const [[guest]] = await conn.query("SELECT user_id FROM users WHERE email='walk-in@parkflow.local'");

  async function vehicle(owner, plate, type, model, color) {
    const [r] = await conn.query('INSERT INTO vehicle (user_id, registration_no, vehicle_type, model_name, color) VALUES (?,?,?,?,?)', [owner, plate, type, model, color]);
    await conn.query(`INSERT INTO ${type} (vehicle_id) VALUES (?)`, [r.insertId]);
    return r.insertId;
  }
  async function session(slot, veh, entryAgoMin, exitAgoMin, rate) {
    const [r] = await conn.query('INSERT INTO parking_session (slot_id, vehicle_id, entry_time, exit_time, hourly_rate) VALUES (?,?,?,?,?)',
      [await slotId(slot), veh, new Date(now - entryAgoMin * min), exitAgoMin == null ? null : new Date(now - exitAgoMin * min), rate]);
    return r.insertId;
  }

  // Currently parked: A2 (48 min), C3 (75 min)
  const v1 = await vehicle(guest.user_id, 'MH-02-CB-1922', 'four_wheeler', 'Sedan Luxe', '#576574');
  await session('A2', v1, 48, null, 50);
  await conn.query("UPDATE parking_slot SET status='occupied' WHERE lot_id=? AND slot_number='A2'", [lotId]);
  const v2 = await vehicle(guest.user_id, 'MH-01-AX-4029', 'four_wheeler', 'City Hatchback', '#FFB7B2');
  await session('C3', v2, 75, null, 50);
  await conn.query("UPDATE parking_slot SET status='occupied' WHERE lot_id=? AND slot_number='C3'", [lotId]);

  // Confirmed reservation on B3 (3h–6h from now) by Rohan Sharma
  const [u] = await conn.query("INSERT INTO users (name, email, phone) VALUES ('Rohan Sharma', NULL, '9820011223')");
  const v3 = await vehicle(u.insertId, 'MH-12-DE-3829', 'four_wheeler', 'CAR Reserved', '#576574');
  await conn.query(
    `INSERT INTO booking (slot_id, user_id, vehicle_id, start_time, end_time, status, estimated_fee, created_at)
     VALUES (?,?,?,?,?, 'confirmed', 162.00, ?)`,
    [await slotId('B3'), u.insertId, v3, new Date(now + 180 * min), new Date(now + 360 * min), new Date(now - 60 * min)]
  );
  await conn.query("UPDATE parking_slot SET status='reserved' WHERE lot_id=? AND slot_number='B3'", [lotId]);

  // One completed, paid session -> receipt
  const v4 = await vehicle(guest.user_id, 'MH-03-FA-9012', 'four_wheeler', null, null);
  const sid = await session('A1', v4, 140, 20, 50);
  const [p] = await conn.query(
    `INSERT INTO payment (session_id, amount, payment_status, paid_at, receipt_number, subtotal, tax, payment_method)
     VALUES (?, 108.00, 'paid', ?, 'SP-104928', 100.00, 8.00, 'UPI / QR Code')`,
    [sid, new Date(now - 20 * min)]
  );
  console.log('[seed] demo data loaded (payment', p.insertId + ')');
}

await pool.end();
console.log('[seed] done');
