# ParkFlow backend (Express + MySQL on Aiven)

Stores **all** ParkFlow data (slots, vehicles, users, bookings, sessions, payments, tariffs) in an
Aiven-hosted **MySQL** database, following the project's ER / EER diagrams. The React app in
`../front_end` talks to it through `/api`.

## 1. Create the Aiven database
1. Aiven Console → **Create service → MySQL** (any plan, including Free).
2. Open the service → **Overview → Connection information** and copy the **Service URI**.
3. Download the **CA certificate** (`ca.pem`) from the same page into `back_end/certs/ca.pem`.
4. If you restricted *Allowed IP addresses*, add the IP of the machine running this backend.

## 2. Run the backend
```bash
cd back_end
cp .env.example .env          # paste your Service URI into DATABASE_URL
npm install
npm run db:migrate            # creates all tables + view
npm run db:seed:demo          # 1 lot, 30 slots, tariffs  (+ the sample data the UI used to hard-code)
#   npm run db:seed           # same, but WITHOUT sample vehicles/bookings
npm run dev                   # http://localhost:4000   (GET /api/health to verify the DB link)
```
`npm run db:reset` drops every ParkFlow table (dev only!).

## 3. Run the frontend
```bash
cd front_end
npm install --legacy-peer-deps
npm run dev                   # http://localhost:3000  (Vite proxies /api -> :4000)
```
### Deploying to Vercel (separate projects)
**Backend** = its own Vercel project with *Root Directory* `back_end` (entry: `api/index.js`, config: `vercel.json`).
Environment variables:

| Name | Value |
|---|---|
| `DATABASE_URL` | Aiven Service URI |
| `DB_SSL_CA_PEM` | contents of Aiven's `ca.pem` (there is no `certs/ca.pem` file on Vercel) |
| `CORS_ORIGIN` | your frontend URL, e.g. `https://parkflow.vercel.app` (comma-separate several; no trailing slash) |
| `DB_POOL_SIZE` | optional, defaults to `3` on Vercel |

Run `npm run db:migrate` / `db:seed` once from your machine first, and set Aiven *Allowed IP addresses* to `0.0.0.0/0`
(Vercel IPs aren't fixed). Verify with `https://<backend>.vercel.app/api/health`.

**Frontend** = a second Vercel project with *Root Directory* `front_end`; set `VITE_API_URL` to the backend URL. See the root `README.md`.

## ER / EER → tables

| Diagram element | Table | Notes |
|---|---|---|
| ParkingLot | `parking_lot` | |
| ParkingSlot (contains, 1:N total) | `parking_slot` | `lot_id` NOT NULL FK |
| EER: ParkingSlot **d** → StandardSlot / AccessibleSlot | `standard_slot`, `accessible_slot` | subclass PK = FK; composite FK `(slot_id, slot_type)` makes the specialization **disjoint** at DB level |
| User | `users` | `email`, `phone` UNIQUE (nullable) |
| Vehicle (User owns Vehicle, 1:N, total on Vehicle) | `vehicle` | `user_id` NOT NULL FK, `registration_no` UNIQUE |
| EER: Vehicle **d** → TwoWheeler / FourWheeler / HeavyVehicle | `two_wheeler`, `four_wheeler`, `heavy_vehicle` | same composite-FK technique |
| Booking (makes / reserved in / booked for) | `booking` | `user_id`, `slot_id`, `vehicle_id` all NOT NULL FKs |
| ParkingSession (hosts / parks in) | `parking_session` | `slot_id`, `vehicle_id` NOT NULL FKs; unique index → max one *open* session per slot and per vehicle |
| `duration` (derived, dashed) | view `v_parking_session` | computed, not stored |
| Payment (generates, Payment 1:1 ← Session 0..1) | `payment` | `session_id` NOT NULL **UNIQUE** |

Columns that are **not** in the diagrams but the existing UI needs (marked `[UI]` in `sql/schema.sql`):
`parking_slot.floor_no / grid_row / grid_col / vehicle_category`, `vehicle.model_name / color`,
`booking.estimated_fee / created_at`, `parking_session.hourly_rate`, and on `payment`:
`receipt_number / subtotal / tax / payment_method`. There is also one extra table, `tariff`
(the admin-editable hourly rates), and a seeded **Walk-in Guest** user who owns vehicles that
enter at the gate without an account, so "every Vehicle has exactly one owner" always holds.

## API (all JSON, prefix `/api`)

| Method & path | Purpose |
|---|---|
| `GET /health` | DB connectivity check |
| `GET /state` | slots + reservations + receipts + tariffs in one call (used by the frontend) |
| `GET /lots`, `GET /slots` | lot summary / all slots (with `currentVehicle` when occupied) |
| `PATCH /slots/:slotId/maintenance` | toggle maintenance (refused while occupied) |
| `POST /sessions/entry` `{slotId, plate, vehicleType}` | vehicle enters → opens a ParkingSession |
| `POST /sessions/exit` `{slotId, paymentMethod}` | closes the session, computes the fee, stores the Payment, returns the receipt |
| `GET /reservations`, `POST /reservations` | list / create a Booking (`slotId, plate, vehicleType, driverName, contactNumber, startTime, endTime` as epoch ms) |
| `POST /reservations/:id/cancel` | cancel |
| `POST /reservations/:id/check-in` | reserved vehicle arrives → booking `completed` + session opened |
| `GET /receipts` | paid receipts, newest first |
| `GET /tariffs`, `PUT /tariffs` `{car, "two-wheeler", heavy}` | hourly rates |

`vehicleType` is `car` (FourWheeler), `two-wheeler` (TwoWheeler) or `heavy` (HeavyVehicle).

### Business rules enforced server-side (inside transactions, with a row lock on the slot)
* A slot can only be entered when `available`; a vehicle can't be parked twice.
* Cars → car slots; two-wheelers → two-wheeler *or* car slots; heavy vehicles → heavy slots.
* Reservation windows `[start, end)` can't overlap an active booking on the same slot (race-safe).
* Fees are computed by the server (1 h minimum, then 30-min blocks, 8 % tax); the client's estimate is ignored.
* Reservations starting within the hour flag the slot `reserved`; cancelling releases it.

## Tests
```bash
npm test                                   # unit tests only (DB tests are skipped)
# Integration tests DROP & recreate the schema – point at a throw-away database only!
TEST_DATABASE_URL=mysql://root:pw@127.0.0.1:3306/parkflow_test DB_SSL=false npm test
```
