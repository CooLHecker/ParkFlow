/**
 * Integration tests against a REAL MySQL database.
 * DESTRUCTIVE: the schema is dropped and re-created, so these only run when
 * TEST_DATABASE_URL is set explicitly (never point it at production data).
 *
 *   TEST_DATABASE_URL=mysql://root:pw@127.0.0.1:3306/parkflow_test DB_SSL=false npm test
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const URL_ = process.env.TEST_DATABASE_URL;
const skip = !URL_ && 'set TEST_DATABASE_URL to run DB integration tests';

let server, base, pool;
const H = 3600 * 1000;

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}
const slotOf = async (id) => (await call('GET', '/api/slots')).body.find((s) => s.id === id);

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  const env = { ...process.env, DATABASE_URL: URL_ };
  execFileSync('node', ['scripts/migrate.js', '--reset'], { env, stdio: 'ignore' });
  execFileSync('node', ['scripts/seed.js'], { env, stdio: 'ignore' });
  const { createApp } = await import('../src/app.js');
  ({ pool } = await import('../src/db.js'));
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (skip) return;
  server.close();
  await pool.end();
});

test('health + bootstrap state', { skip }, async () => {
  assert.equal((await call('GET', '/api/health')).body.status, 'ok');
  const { body } = await call('GET', '/api/state');
  assert.equal(body.slots.length, 30);
  assert.deepEqual(body.tariffs, { car: 50, 'two-wheeler': 20, heavy: 120 });
  assert.equal(body.slots[0].id, 'A1');
  assert.equal(body.slots[0].floor, 'Floor 1');
});

test('walk-in entry, rules and exit with receipt', { skip }, async () => {
  let r = await call('POST', '/api/sessions/entry', { slotId: 'A3', plate: ' mh-01-aa-0001 ', vehicleType: 'car' });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'occupied');
  assert.equal(r.body.currentVehicle.plate, 'MH-01-AA-0001');
  assert.equal(r.body.currentVehicle.hourlyTariff, 50);

  assert.equal((await call('POST', '/api/sessions/entry', { slotId: 'A3', plate: 'MH-01-AA-0002', vehicleType: 'car' })).status, 409); // slot taken
  assert.equal((await call('POST', '/api/sessions/entry', { slotId: 'A4', plate: 'MH-01-AA-0001', vehicleType: 'car' })).status, 409); // already parked
  assert.equal((await call('POST', '/api/sessions/entry', { slotId: 'A5', plate: 'MH-01-AA-0003', vehicleType: 'car' })).status, 409); // car in 2W slot
  assert.equal((await call('POST', '/api/sessions/entry', { slotId: 'B1', plate: 'MH-01-BB-0001', vehicleType: 'two-wheeler' })).status, 201); // 2W may use car slot
  assert.equal((await call('POST', '/api/sessions/entry', { slotId: 'ZZ9', plate: 'X', vehicleType: 'car' })).status, 404);
  assert.equal((await call('POST', '/api/sessions/entry', { slotId: 'A4', plate: 'X', vehicleType: 'spaceship' })).status, 400);

  r = await call('POST', '/api/sessions/exit', { slotId: 'A3', paymentMethod: 'UPI / QR Code' });
  assert.equal(r.status, 200);
  assert.equal(r.body.totalAmount, 54);
  assert.equal(r.body.subtotal, 50);
  assert.equal(r.body.tax, 4);
  assert.equal(r.body.paymentMethod, 'UPI / QR Code');
  assert.match(r.body.receiptNumber, /^SP-\d+$/);
  assert.equal((await slotOf('A3')).status, 'available');
  assert.equal((await call('POST', '/api/sessions/exit', { slotId: 'A3' })).status, 409);

  const receipts = (await call('GET', '/api/receipts')).body;
  assert.equal(receipts[0].vehiclePlate, 'MH-01-AA-0001');
  assert.equal(receipts[0].id, r.body.id);
});

test('reservations: overlap prevention, slot flagging, cancel', { skip }, async () => {
  const t = Date.now();
  const mk = (slotId, s, e, plate = 'MH-02-RR-0001', name = 'Rohan', phone = '9820011223') =>
    call('POST', '/api/reservations', { slotId, plate, vehicleType: 'car', driverName: name, contactNumber: phone, startTime: t + s * H, endTime: t + e * H });

  let r = await mk('D1', 2, 4);
  assert.equal(r.status, 201);
  assert.equal(r.body.estimatedFee, 108); // 2h * 50 * 1.08
  assert.equal(r.body.status, 'confirmed');
  assert.equal((await slotOf('D1')).status, 'available'); // starts in >1h

  assert.equal((await mk('D1', 3, 5, 'MH-02-RR-0002')).status, 409); // overlaps
  assert.equal((await mk('D1', 4, 5, 'MH-02-RR-0003')).status, 201); // adjacent is fine
  assert.equal((await mk('D1', 5, 4, 'MH-02-RR-0004')).status, 400); // end before start

  r = await mk('D2', 0.2, 1, 'MH-02-RR-0005');
  assert.equal(r.status, 201);
  assert.equal((await slotOf('D2')).status, 'reserved'); // starts within the hour
  const id = r.body.id;
  assert.equal((await call('POST', `/api/reservations/${id}/cancel`)).body.status, 'cancelled');
  assert.equal((await slotOf('D2')).status, 'available');
  assert.equal((await call('POST', `/api/reservations/${id}/cancel`)).status, 409);
  assert.equal((await call('POST', `/api/reservations/9999/cancel`)).status, 404);

  // cancelled bookings no longer block the window
  assert.equal((await mk('D2', 0.2, 1, 'MH-02-RR-0006')).status, 201);
  const list = (await call('GET', '/api/reservations')).body;
  assert.equal(list[0].vehiclePlate, 'MH-02-RR-0006'); // newest first
  assert.equal(list[0].driverName, 'Rohan');
  assert.equal(list[0].contactNumber, '9820011223');
});

test('check-in turns a booking into a session owned by the booker', { skip }, async () => {
  const t = Date.now();
  const r = await call('POST', '/api/reservations', {
    slotId: 'E2', plate: 'MH-03-CC-0001', vehicleType: 'car', driverName: 'Meera', contactNumber: '9000000001',
    startTime: t + 600_000, endTime: t + 2 * H,
  });
  assert.equal(r.status, 201);
  const ci = await call('POST', `/api/reservations/${r.body.id}/check-in`);
  assert.equal(ci.status, 200);
  assert.equal(ci.body.slot.status, 'occupied');
  assert.equal(ci.body.slot.currentVehicle.plate, 'MH-03-CC-0001');
  assert.equal(ci.body.reservation.status, 'completed');
  assert.equal((await call('POST', `/api/reservations/${r.body.id}/check-in`)).status, 409);

  const [[row]] = await pool.query(
    'SELECT u.name FROM vehicle v JOIN users u ON u.user_id = v.user_id WHERE v.registration_no = ?', ['MH-03-CC-0001']);
  assert.equal(row.name, 'Meera');
});

test('a walk-in vehicle gets its real owner when later booked', { skip }, async () => {
  await call('POST', '/api/sessions/entry', { slotId: 'F2', plate: 'MH-04-WW-0001', vehicleType: 'car' });
  await call('POST', '/api/sessions/exit', { slotId: 'F2', paymentMethod: 'Cash' });
  const t = Date.now();
  await call('POST', '/api/reservations', { slotId: 'F3', plate: 'MH-04-WW-0001', vehicleType: 'car', driverName: 'Asha', contactNumber: '9000000002', startTime: t + 5 * H, endTime: t + 6 * H });
  const [[row]] = await pool.query('SELECT u.name FROM vehicle v JOIN users u USING (user_id) WHERE registration_no = ?', ['MH-04-WW-0001']);
  assert.equal(row.name, 'Asha');
});

test('maintenance toggle and tariff updates', { skip }, async () => {
  assert.equal((await call('PATCH', '/api/slots/F1/maintenance')).body.status, 'maintenance');
  assert.equal((await call('POST', '/api/sessions/entry', { slotId: 'F1', plate: 'MH-05-MM-0001', vehicleType: 'car' })).status, 409);
  assert.equal((await call('PATCH', '/api/slots/F1/maintenance')).body.status, 'available');
  assert.equal((await call('PATCH', '/api/slots/E2/maintenance')).status, 409); // occupied (from the check-in test)

  assert.equal((await call('PUT', '/api/tariffs', { car: -5 })).status, 400);
  assert.equal((await call('PUT', '/api/tariffs', { plane: 5 })).status, 400);
  assert.equal((await call('PUT', '/api/tariffs', { car: 60 })).body.car, 60);
  await call('POST', '/api/sessions/entry', { slotId: 'F4', plate: 'MH-05-TT-0001', vehicleType: 'car' });
  const r = await call('POST', '/api/sessions/exit', { slotId: 'F4', paymentMethod: 'Cash' });
  assert.equal(r.body.hourlyTariff, 60);
  assert.equal(r.body.totalAmount, 64.8);
  await call('PUT', '/api/tariffs', { car: 50 });
});

test('concurrency: only one winner for the same slot / time window', { skip }, async () => {
  const entries = await Promise.all(
    ['MH-06-CO-0001', 'MH-06-CO-0002', 'MH-06-CO-0003'].map((plate) =>
      call('POST', '/api/sessions/entry', { slotId: 'B2', plate, vehicleType: 'car' }))
  );
  assert.deepEqual(entries.map((e) => e.status).sort(), [201, 409, 409]);

  const t = Date.now();
  const bookings = await Promise.all(
    [1, 2, 3, 4].map((i) =>
      call('POST', '/api/reservations', { slotId: 'B4', plate: `MH-06-BK-000${i}`, vehicleType: 'car', driverName: `P${i}`, contactNumber: `90000100${i}`, startTime: t + 8 * H, endTime: t + 9 * H }))
  );
  assert.equal(bookings.filter((b) => b.status === 201).length, 1);
  assert.equal(bookings.filter((b) => b.status === 409).length, 3);
});

test('EER constraints are enforced by the database itself', { skip }, async () => {
  // slot A1 is AccessibleSlot: it must not be insertable into StandardSlot
  const [[a1]] = await pool.query("SELECT slot_id FROM parking_slot WHERE slot_number = 'A1'");
  await assert.rejects(() => pool.query('INSERT INTO standard_slot (slot_id) VALUES (?)', [a1.slot_id]));
  // a four-wheeler vehicle must not also be a two-wheeler
  const [[v]] = await pool.query("SELECT vehicle_id FROM vehicle WHERE registration_no = 'MH-01-AA-0001'");
  await assert.rejects(() => pool.query('INSERT INTO two_wheeler (vehicle_id) VALUES (?)', [v.vehicle_id]));
  // one payment per session (Payment (1,1) -- ParkingSession (0,1))
  await assert.rejects(() => pool.query(
    "INSERT INTO payment (session_id, amount, payment_status) SELECT session_id, 1, 'paid' FROM payment LIMIT 1"));
  // a slot can have only one open session
  const [[open]] = await pool.query('SELECT slot_id, vehicle_id FROM parking_session WHERE exit_time IS NULL LIMIT 1');
  await assert.rejects(() => pool.query(
    "INSERT INTO parking_session (slot_id, vehicle_id, entry_time, hourly_rate) VALUES (?, ?, NOW(), 10)", [open.slot_id, open.vehicle_id]));
});
