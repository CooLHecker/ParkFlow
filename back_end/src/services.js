import { pool, withTransaction } from './db.js';
import { config } from './config.js';
import { calculateParkingFee } from './fee.js';
import { badRequest, conflict, notFound, HttpError } from './errors.js';

/* ------------------------------------------------------------------ */
/* Vehicle-type mapping: frontend names  <->  EER / database names     */
/* ------------------------------------------------------------------ */
const API_TO_DB = { car: 'four_wheeler', 'two-wheeler': 'two_wheeler', heavy: 'heavy_vehicle' };
const DB_TO_API = { four_wheeler: 'car', two_wheeler: 'two-wheeler', heavy_vehicle: 'heavy' };
// subclass table for each discriminator value (whitelist – safe to interpolate)
const SUBCLASS_TABLE = { two_wheeler: 'two_wheeler', four_wheeler: 'four_wheeler', heavy_vehicle: 'heavy_vehicle' };
const SLOT_SUBCLASS_TABLE = { standard: 'standard_slot', accessible: 'accessible_slot' };

const DEFAULT_COLOR = { two_wheeler: '#E59866', four_wheeler: '#576574', heavy_vehicle: '#8395A7' };
const SOON_MS = 3600 * 1000; // reservations starting within 1h flag the slot as "reserved"
const GUEST_EMAIL = 'walk-in@parkflow.local';

function parseVehicleType(input) {
  const dbType = API_TO_DB[input] || (Object.values(API_TO_DB).includes(input) ? input : null);
  if (!dbType) throw badRequest(`vehicleType must be one of: ${Object.keys(API_TO_DB).join(', ')}`);
  return dbType;
}

function parsePlate(input) {
  const plate = String(input ?? '').trim().toUpperCase();
  if (!plate) throw badRequest('Vehicle registration number is required.');
  if (plate.length > 20) throw badRequest('Vehicle registration number is too long (max 20 characters).');
  return plate;
}

function parseSlotId(input) {
  const id = String(input ?? '').trim();
  if (!id) throw badRequest('slotId is required.');
  return id;
}

function parseEpoch(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw badRequest(`${field} must be a valid epoch-millisecond timestamp.`);
  return new Date(Math.floor(n));
}

function slotFits(slotCategory, vehicleDbType) {
  if (vehicleDbType === 'four_wheeler') return slotCategory === 'four_wheeler';
  if (vehicleDbType === 'two_wheeler') return slotCategory === 'two_wheeler' || slotCategory === 'four_wheeler';
  return slotCategory === 'heavy_vehicle';
}

const round2 = (n) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/* Row -> API shape mappers (match front_end/src/types/parking.ts)     */
/* ------------------------------------------------------------------ */
function mapSlot(r) {
  const slot = {
    id: r.slot_number,
    label: `Slot ${r.slot_number}`,
    floor: `Floor ${r.floor_no}`,
    floorNumber: r.floor_no,
    type: DB_TO_API[r.vehicle_category],
    slotType: r.slot_type, // 'standard' | 'accessible' (EER specialization)
    status: r.status,
    row: r.grid_row,
    col: r.grid_col,
  };
  if (r.session_id && r.registration_no) {
    slot.currentVehicle = {
      plate: r.registration_no,
      modelName: r.model_name || `${DB_TO_API[r.vehicle_type].toUpperCase()} Carrier`,
      vehicleType: DB_TO_API[r.vehicle_type],
      color: r.color || DEFAULT_COLOR[r.vehicle_type],
      entryTime: r.entry_time.getTime(),
      hourlyTariff: r.hourly_rate,
    };
  }
  return slot;
}

function mapReservation(r) {
  return {
    id: String(r.booking_id),
    slotId: r.slot_number,
    slotLabel: `Slot ${r.slot_number}`,
    floor: `Floor ${r.floor_no}`,
    vehiclePlate: r.registration_no,
    vehicleType: DB_TO_API[r.vehicle_type],
    driverName: r.name,
    contactNumber: r.phone || '',
    startTime: r.start_time.getTime(),
    endTime: r.end_time.getTime(),
    estimatedFee: r.estimated_fee,
    status: r.status,
    createdAt: r.created_at.getTime(),
  };
}

function mapReceipt(r) {
  const entry = r.entry_time.getTime();
  const exit = r.exit_time.getTime();
  const fee = calculateParkingFee(entry, exit, r.hourly_rate, config.taxRate);
  return {
    id: String(r.payment_id),
    receiptNumber: r.receipt_number,
    slotLabel: `Slot ${r.slot_number}`,
    floor: `Floor ${r.floor_no}`,
    vehiclePlate: r.registration_no,
    vehicleType: DB_TO_API[r.vehicle_type],
    entryTime: entry,
    exitTime: exit,
    durationFormatted: fee.durationFormatted,
    durationMinutes: fee.durationMinutes,
    hourlyTariff: r.hourly_rate,
    subtotal: r.subtotal,
    tax: r.tax,
    totalAmount: r.amount,
    paymentMethod: r.payment_method || 'Cash',
    paymentStatus: 'paid',
    issuedAt: r.paid_at.getTime(),
  };
}

/* ------------------------------------------------------------------ */
/* Queries (take any executor: pool or a transaction connection)       */
/* ------------------------------------------------------------------ */
let cachedLotId = null;
async function getLotId(db) {
  if (cachedLotId) return cachedLotId;
  const [rows] = await db.query('SELECT lot_id FROM parking_lot ORDER BY lot_id LIMIT 1');
  if (!rows.length) throw new HttpError(500, 'Database is empty. Run "npm run db:seed" first.');
  cachedLotId = rows[0].lot_id;
  return cachedLotId;
}
export function _resetLotCache() {
  cachedLotId = null;
}

const SLOT_SELECT = `
  SELECT s.slot_id, s.slot_number, s.slot_type, s.status, s.vehicle_category,
         s.floor_no, s.grid_row, s.grid_col,
         ps.session_id, ps.entry_time, ps.hourly_rate,
         v.registration_no, v.vehicle_type, v.model_name, v.color
  FROM parking_slot s
  LEFT JOIN parking_session ps ON ps.slot_id = s.slot_id AND ps.exit_time IS NULL
  LEFT JOIN vehicle v ON v.vehicle_id = ps.vehicle_id
  WHERE s.lot_id = ?`;

async function queryAllSlots(db, lotId) {
  const [rows] = await db.query(`${SLOT_SELECT} ORDER BY s.floor_no, s.grid_row, s.grid_col`, [lotId]);
  return rows.map(mapSlot);
}

async function queryOneSlot(db, lotId, slotNumber) {
  const [rows] = await db.query(`${SLOT_SELECT} AND s.slot_number = ?`, [lotId, slotNumber]);
  return rows.length ? mapSlot(rows[0]) : null;
}

const RESERVATION_SELECT = `
  SELECT b.booking_id, b.start_time, b.end_time, b.status, b.estimated_fee, b.created_at,
         s.slot_number, s.floor_no, u.name, u.phone, v.registration_no, v.vehicle_type
  FROM booking b
  JOIN parking_slot s ON s.slot_id = b.slot_id
  JOIN users u ON u.user_id = b.user_id
  JOIN vehicle v ON v.vehicle_id = b.vehicle_id
  WHERE s.lot_id = ?`;

async function queryReservations(db, lotId) {
  const [rows] = await db.query(`${RESERVATION_SELECT} ORDER BY b.created_at DESC, b.booking_id DESC`, [lotId]);
  return rows.map(mapReservation);
}

async function queryOneReservation(db, lotId, bookingId) {
  const [rows] = await db.query(`${RESERVATION_SELECT} AND b.booking_id = ?`, [lotId, bookingId]);
  return rows.length ? mapReservation(rows[0]) : null;
}

const RECEIPT_SELECT = `
  SELECT p.payment_id, p.receipt_number, p.amount, p.subtotal, p.tax, p.payment_method, p.paid_at,
         ps.entry_time, ps.exit_time, ps.hourly_rate,
         s.slot_number, s.floor_no, v.registration_no, v.vehicle_type
  FROM payment p
  JOIN parking_session ps ON ps.session_id = p.session_id
  JOIN parking_slot s ON s.slot_id = ps.slot_id
  JOIN vehicle v ON v.vehicle_id = ps.vehicle_id
  WHERE p.payment_status = 'paid' AND s.lot_id = ?`;

async function queryReceipts(db, lotId) {
  const [rows] = await db.query(`${RECEIPT_SELECT} ORDER BY p.paid_at DESC, p.payment_id DESC`, [lotId]);
  return rows.map(mapReceipt);
}

async function queryOneReceipt(db, lotId, paymentId) {
  const [rows] = await db.query(`${RECEIPT_SELECT} AND p.payment_id = ?`, [lotId, paymentId]);
  return rows.length ? mapReceipt(rows[0]) : null;
}

async function queryTariffs(db) {
  const [rows] = await db.query('SELECT vehicle_type, hourly_rate FROM tariff');
  const out = {};
  for (const r of rows) out[DB_TO_API[r.vehicle_type]] = r.hourly_rate;
  return out;
}

/* ------------------------------------------------------------------ */
/* Public read API                                                     */
/* ------------------------------------------------------------------ */
export async function getLots() {
  const [rows] = await pool.query(
    `SELECT l.lot_id, l.lot_name, l.location, COUNT(s.slot_id) AS total_slots,
            SUM(s.status = 'available') AS available_slots
     FROM parking_lot l LEFT JOIN parking_slot s ON s.lot_id = l.lot_id
     GROUP BY l.lot_id, l.lot_name, l.location ORDER BY l.lot_id`
  );
  return rows.map((r) => ({
    id: r.lot_id,
    name: r.lot_name,
    location: r.location,
    totalSlots: Number(r.total_slots),
    availableSlots: Number(r.available_slots || 0),
  }));
}

export async function getSlots() {
  return queryAllSlots(pool, await getLotId(pool));
}
export async function getReservations() {
  return queryReservations(pool, await getLotId(pool));
}
export async function getReceipts() {
  return queryReceipts(pool, await getLotId(pool));
}
export async function getTariffs() {
  return queryTariffs(pool);
}

/** Everything the frontend needs on page-load, in one round trip. */
export async function getState() {
  const lotId = await getLotId(pool);
  const [slots, reservations, receipts, tariffs] = await Promise.all([
    queryAllSlots(pool, lotId),
    queryReservations(pool, lotId),
    queryReceipts(pool, lotId),
    queryTariffs(pool),
  ]);
  return { slots, reservations, receipts, tariffs };
}

/* ------------------------------------------------------------------ */
/* Helpers used inside transactions                                    */
/* ------------------------------------------------------------------ */
async function lockSlot(conn, lotId, slotNumber) {
  const [rows] = await conn.query('SELECT * FROM parking_slot WHERE lot_id = ? AND slot_number = ? FOR UPDATE', [
    lotId,
    slotNumber,
  ]);
  if (!rows.length) throw notFound(`Slot ${slotNumber} does not exist.`);
  return rows[0];
}

async function getGuestUserId(conn) {
  const [rows] = await conn.query('SELECT user_id FROM users WHERE email = ?', [GUEST_EMAIL]);
  if (rows.length) return rows[0].user_id;
  const [res] = await conn.query('INSERT INTO users (name, email, phone) VALUES (?, ?, NULL)', [
    'Walk-in Guest',
    GUEST_EMAIL,
  ]);
  return res.insertId;
}

function normalisePhone(input) {
  const p = String(input ?? '').replace(/[^\d+]/g, '');
  if (p.length > 20) throw badRequest('Contact number is too long.');
  return p || null;
}

async function findOrCreateUser(conn, name, phone) {
  const cleanName = String(name ?? '').trim();
  if (!cleanName) throw badRequest('driverName is required.');
  if (cleanName.length > 100) throw badRequest('driverName is too long (max 100 characters).');
  if (phone) {
    const [rows] = await conn.query('SELECT user_id, name FROM users WHERE phone = ? FOR UPDATE', [phone]);
    if (rows.length) {
      if (rows[0].name !== cleanName) {
        await conn.query('UPDATE users SET name = ? WHERE user_id = ?', [cleanName, rows[0].user_id]);
      }
      return rows[0].user_id;
    }
  }
  const [res] = await conn.query('INSERT INTO users (name, email, phone) VALUES (?, NULL, ?)', [cleanName, phone]);
  return res.insertId;
}

/**
 * Find a vehicle by registration number or create it (+ its EER subclass row).
 * Walk-in vehicles are owned by the "Walk-in Guest" user so that the ER's total
 * participation (every Vehicle has exactly one owner) always holds.
 */
async function ensureVehicle(conn, { plate, dbType, ownerUserId, modelName = null, color = null }) {
  const [rows] = await conn.query('SELECT * FROM vehicle WHERE registration_no = ? FOR UPDATE', [plate]);
  if (rows.length) {
    const v = rows[0];
    if (v.vehicle_type !== dbType) {
      throw conflict(
        `Vehicle ${plate} is already registered as a ${DB_TO_API[v.vehicle_type]}, not a ${DB_TO_API[dbType]}.`
      );
    }
    return v;
  }
  const owner = ownerUserId ?? (await getGuestUserId(conn));
  const [res] = await conn.query(
    'INSERT INTO vehicle (user_id, registration_no, vehicle_type, model_name, color) VALUES (?, ?, ?, ?, ?)',
    [owner, plate, dbType, modelName, color]
  );
  await conn.query(`INSERT INTO ${SUBCLASS_TABLE[dbType]} (vehicle_id) VALUES (?)`, [res.insertId]);
  return { vehicle_id: res.insertId, user_id: owner, registration_no: plate, vehicle_type: dbType };
}

async function getHourlyRate(conn, dbType) {
  const [rows] = await conn.query('SELECT hourly_rate FROM tariff WHERE vehicle_type = ?', [dbType]);
  if (!rows.length) throw new HttpError(500, `No tariff configured for ${DB_TO_API[dbType]}. Run "npm run db:seed".`);
  return rows[0].hourly_rate;
}

/** Opens a ParkingSession for a vehicle in an already-locked slot and marks the slot occupied. */
async function openSession(conn, slot, vehicle, entry = new Date()) {
  const [open] = await conn.query('SELECT session_id FROM parking_session WHERE vehicle_id = ? AND exit_time IS NULL', [
    vehicle.vehicle_id,
  ]);
  if (open.length) throw conflict(`Vehicle ${vehicle.registration_no} is already parked.`);
  const rate = await getHourlyRate(conn, vehicle.vehicle_type);
  await conn.query(
    'INSERT INTO parking_session (slot_id, vehicle_id, entry_time, exit_time, hourly_rate) VALUES (?, ?, ?, NULL, ?)',
    [slot.slot_id, vehicle.vehicle_id, entry, rate]
  );
  await conn.query("UPDATE parking_slot SET status = 'occupied' WHERE slot_id = ?", [slot.slot_id]);
}

/* ------------------------------------------------------------------ */
/* Walk-in entry / exit                                                */
/* ------------------------------------------------------------------ */
export async function parkVehicle({ slotId, plate, vehicleType }) {
  const slotNumber = parseSlotId(slotId);
  const regNo = parsePlate(plate);
  const dbType = parseVehicleType(vehicleType);

  return withTransaction(async (conn) => {
    const lotId = await getLotId(conn);
    const slot = await lockSlot(conn, lotId, slotNumber);
    if (slot.status !== 'available') {
      throw conflict(`Slot ${slotNumber} is not available (currently ${slot.status}).`);
    }
    if (!slotFits(slot.vehicle_category, dbType)) {
      throw conflict(`Slot ${slotNumber} (${DB_TO_API[slot.vehicle_category]} slot) cannot take a ${DB_TO_API[dbType]}.`);
    }
    const vehicle = await ensureVehicle(conn, { plate: regNo, dbType });
    await openSession(conn, slot, vehicle);
    return queryOneSlot(conn, lotId, slotNumber);
  });
}

export async function exitVehicle({ slotId, paymentMethod }) {
  const slotNumber = parseSlotId(slotId);
  const method = String(paymentMethod ?? '').trim().slice(0, 40) || 'Cash';

  return withTransaction(async (conn) => {
    const lotId = await getLotId(conn);
    const slot = await lockSlot(conn, lotId, slotNumber);
    const [sessions] = await conn.query(
      'SELECT * FROM parking_session WHERE slot_id = ? AND exit_time IS NULL FOR UPDATE',
      [slot.slot_id]
    );
    if (!sessions.length) throw conflict(`No vehicle is currently parked in slot ${slotNumber}.`);
    const session = sessions[0];

    const exitAt = new Date(Math.max(Date.now(), session.entry_time.getTime()));
    const fee = calculateParkingFee(session.entry_time.getTime(), exitAt.getTime(), session.hourly_rate, config.taxRate);

    await conn.query('UPDATE parking_session SET exit_time = ? WHERE session_id = ?', [exitAt, session.session_id]);
    const [pay] = await conn.query(
      `INSERT INTO payment (session_id, amount, payment_status, paid_at, subtotal, tax, payment_method)
       VALUES (?, ?, 'paid', ?, ?, ?, ?)`,
      [session.session_id, fee.total, exitAt, fee.subtotal, fee.tax, method]
    );
    await conn.query('UPDATE payment SET receipt_number = ? WHERE payment_id = ?', [
      `SP-${100000 + pay.insertId}`,
      pay.insertId,
    ]);
    await conn.query("UPDATE parking_slot SET status = 'available' WHERE slot_id = ?", [slot.slot_id]);
    return queryOneReceipt(conn, lotId, pay.insertId);
  });
}

/* ------------------------------------------------------------------ */
/* Reservations (Booking)                                              */
/* ------------------------------------------------------------------ */
export async function createReservation(body) {
  const slotNumber = parseSlotId(body.slotId);
  const regNo = parsePlate(body.plate ?? body.vehiclePlate);
  const dbType = parseVehicleType(body.vehicleType);
  const start = parseEpoch(body.startTime, 'startTime');
  const end = parseEpoch(body.endTime, 'endTime');
  if (end <= start) throw badRequest('endTime must be after startTime.');
  if (end.getTime() <= Date.now()) throw badRequest('Reservation must end in the future.');
  const phone = normalisePhone(body.contactNumber);

  return withTransaction(async (conn) => {
    const lotId = await getLotId(conn);
    const slot = await lockSlot(conn, lotId, slotNumber);
    if (slot.status === 'maintenance') throw conflict(`Slot ${slotNumber} is under maintenance.`);
    if (!slotFits(slot.vehicle_category, dbType)) {
      throw conflict(`Slot ${slotNumber} (${DB_TO_API[slot.vehicle_category]} slot) cannot take a ${DB_TO_API[dbType]}.`);
    }

    // Overlap prevention: [start,end) must not intersect any active booking for this slot.
    const [clash] = await conn.query(
      `SELECT booking_id FROM booking
       WHERE slot_id = ? AND status IN ('pending','confirmed') AND start_time < ? AND end_time > ? LIMIT 1`,
      [slot.slot_id, end, start]
    );
    if (clash.length) {
      throw conflict(`Overlap Conflict: Slot ${slotNumber} on Floor ${slot.floor_no} is already reserved during that time window.`);
    }

    const userId = await findOrCreateUser(conn, body.driverName, phone);
    const vehicle = await ensureVehicle(conn, { plate: regNo, dbType, ownerUserId: userId });
    // A walk-in vehicle that now has a real booker gets that person as its owner.
    const guestId = await getGuestUserId(conn);
    if (vehicle.user_id === guestId && userId !== guestId) {
      await conn.query('UPDATE vehicle SET user_id = ? WHERE vehicle_id = ?', [userId, vehicle.vehicle_id]);
    }

    const rate = await getHourlyRate(conn, dbType);
    const estimatedFee = calculateParkingFee(start.getTime(), end.getTime(), rate, config.taxRate).total;

    const [ins] = await conn.query(
      `INSERT INTO booking (slot_id, user_id, vehicle_id, start_time, end_time, status, estimated_fee, created_at)
       VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?)`,
      [slot.slot_id, userId, vehicle.vehicle_id, start, end, estimatedFee, new Date()]
    );

    if (start.getTime() - Date.now() < SOON_MS && slot.status === 'available') {
      await conn.query("UPDATE parking_slot SET status = 'reserved' WHERE slot_id = ?", [slot.slot_id]);
    }
    return queryOneReservation(conn, lotId, ins.insertId);
  });
}

export async function cancelReservation(id) {
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) throw badRequest('Invalid reservation id.');

  return withTransaction(async (conn) => {
    const lotId = await getLotId(conn);
    const [rows] = await conn.query('SELECT * FROM booking WHERE booking_id = ? FOR UPDATE', [bookingId]);
    if (!rows.length) throw notFound('Reservation not found.');
    const booking = rows[0];
    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw conflict(`Reservation is already ${booking.status}.`);
    }
    await conn.query("UPDATE booking SET status = 'cancelled' WHERE booking_id = ?", [bookingId]);

    const [[slot]] = await conn.query('SELECT * FROM parking_slot WHERE slot_id = ? FOR UPDATE', [booking.slot_id]);
    if (slot.status === 'reserved') {
      // Release the slot only if no other active booking still needs it right now.
      const now = new Date();
      const [others] = await conn.query(
        `SELECT booking_id FROM booking
         WHERE slot_id = ? AND booking_id <> ? AND status IN ('pending','confirmed')
           AND start_time < ? AND end_time > ? LIMIT 1`,
        [slot.slot_id, bookingId, new Date(now.getTime() + SOON_MS), now]
      );
      if (!others.length) {
        await conn.query("UPDATE parking_slot SET status = 'available' WHERE slot_id = ?", [slot.slot_id]);
      }
    }
    return queryOneReservation(conn, lotId, bookingId);
  });
}

/** Admin gate: the reserved vehicle arrives -> booking completed, session opened. */
export async function checkInReservation(id) {
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) throw badRequest('Invalid reservation id.');

  return withTransaction(async (conn) => {
    const lotId = await getLotId(conn);
    const [rows] = await conn.query('SELECT * FROM booking WHERE booking_id = ? FOR UPDATE', [bookingId]);
    if (!rows.length) throw notFound('Reservation not found.');
    const booking = rows[0];
    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw conflict(`Reservation is ${booking.status} and cannot be checked in.`);
    }
    const [[slot]] = await conn.query('SELECT * FROM parking_slot WHERE slot_id = ? FOR UPDATE', [booking.slot_id]);
    if (!['available', 'reserved'].includes(slot.status)) {
      throw conflict(`Slot ${slot.slot_number} is ${slot.status}; the vehicle cannot be checked in right now.`);
    }
    const [[vehicle]] = await conn.query('SELECT * FROM vehicle WHERE vehicle_id = ?', [booking.vehicle_id]);

    await openSession(conn, slot, vehicle);
    await conn.query("UPDATE booking SET status = 'completed' WHERE booking_id = ?", [bookingId]);
    return {
      slot: await queryOneSlot(conn, lotId, slot.slot_number),
      reservation: await queryOneReservation(conn, lotId, bookingId),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Admin: maintenance + tariffs                                        */
/* ------------------------------------------------------------------ */
export async function toggleMaintenance(slotId) {
  const slotNumber = parseSlotId(slotId);
  return withTransaction(async (conn) => {
    const lotId = await getLotId(conn);
    const slot = await lockSlot(conn, lotId, slotNumber);
    if (slot.status === 'occupied') {
      throw conflict(`Slot ${slotNumber} is occupied. Check the vehicle out before starting maintenance.`);
    }
    const next = slot.status === 'maintenance' ? 'available' : 'maintenance';
    await conn.query('UPDATE parking_slot SET status = ? WHERE slot_id = ?', [next, slot.slot_id]);
    return queryOneSlot(conn, lotId, slotNumber);
  });
}

export async function updateTariffs(body) {
  if (!body || typeof body !== 'object') throw badRequest('Body must be an object like {"car": 50, "two-wheeler": 20}.');
  const entries = Object.entries(body);
  if (!entries.length) throw badRequest('No tariffs supplied.');
  for (const [key, value] of entries) {
    if (!API_TO_DB[key]) throw badRequest(`Unknown vehicle type "${key}".`);
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || n > 100000) throw badRequest(`Tariff for ${key} must be a positive number.`);
  }
  return withTransaction(async (conn) => {
    for (const [key, value] of entries) {
      await conn.query(
        `INSERT INTO tariff (vehicle_type, hourly_rate) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE hourly_rate = VALUES(hourly_rate)`,
        [API_TO_DB[key], round2(Number(value))]
      );
    }
    return queryTariffs(conn);
  });
}

/* ------------------------------------------------------------------ */
/* Used by the seed script: create a slot + its EER subclass row       */
/* ------------------------------------------------------------------ */
export async function insertSlot(conn, { lotId, slotNumber, slotType = 'standard', vehicleCategory, floorNo, row, col, status = 'available' }) {
  const [res] = await conn.query(
    `INSERT INTO parking_slot (lot_id, slot_number, slot_type, status, vehicle_category, floor_no, grid_row, grid_col)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [lotId, slotNumber, slotType, status, vehicleCategory, floorNo, row, col]
  );
  await conn.query(`INSERT INTO ${SLOT_SUBCLASS_TABLE[slotType]} (slot_id) VALUES (?)`, [res.insertId]);
  return res.insertId;
}
