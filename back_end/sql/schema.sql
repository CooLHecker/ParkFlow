-- =====================================================================
-- ParkFlow – Parking Management System  (MySQL 8.x / Aiven for MySQL)
-- Implements the project's ER + EER diagrams.
--
-- Notes
--  * Every table has a PRIMARY KEY (Aiven MySQL enforces
--    sql_require_primary_key = ON by default).
--  * EER specializations (disjoint "d" circles) are implemented as
--    subclass tables whose (id, type) composite FK points back to the
--    supertype, so the discriminator can never disagree with the
--    subclass table the row lives in => disjointness is enforced by the DB.
--  * No triggers / stored routines are used (portable on managed MySQL).
--  * "duration" in ParkingSession is a DERIVED attribute (dashed oval),
--    so it is NOT stored: see view v_parking_session.
--  * Columns marked [UI] are not in the ER/EER diagrams but are required
--    by the existing frontend (floor layout, receipts, tariffs, ...).
-- =====================================================================

-- ---------- ParkingLot --------------------------------------------
CREATE TABLE IF NOT EXISTS parking_lot (
  lot_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_name  VARCHAR(100) NOT NULL,
  location  VARCHAR(255) NOT NULL,
  PRIMARY KEY (lot_id)
) ENGINE=InnoDB;

-- ---------- ParkingSlot  (ParkingLot 1 --contains-- N ParkingSlot) --
CREATE TABLE IF NOT EXISTS parking_slot (
  slot_id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_id            INT UNSIGNED NOT NULL,                      -- contains (1,1)
  slot_number       VARCHAR(20)  NOT NULL,
  slot_type         ENUM('standard','accessible') NOT NULL DEFAULT 'standard',  -- EER discriminator
  status            ENUM('available','occupied','reserved','maintenance') NOT NULL DEFAULT 'available',
  vehicle_category  ENUM('two_wheeler','four_wheeler','heavy_vehicle') NOT NULL DEFAULT 'four_wheeler', -- [UI]
  floor_no          TINYINT UNSIGNED NOT NULL,                  -- [UI]
  grid_row          TINYINT UNSIGNED NOT NULL,                  -- [UI]
  grid_col          TINYINT UNSIGNED NOT NULL,                  -- [UI]
  PRIMARY KEY (slot_id),
  UNIQUE KEY uq_slot_number_per_lot (lot_id, slot_number),
  UNIQUE KEY uq_slot_id_type (slot_id, slot_type),              -- target of subclass composite FKs
  KEY idx_slot_layout (lot_id, floor_no, grid_row, grid_col),
  CONSTRAINT fk_slot_lot FOREIGN KEY (lot_id) REFERENCES parking_lot (lot_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------- EER: ParkingSlot  d--> StandardSlot | AccessibleSlot ---
CREATE TABLE IF NOT EXISTS standard_slot (
  slot_id    INT UNSIGNED NOT NULL,
  slot_type  ENUM('standard','accessible') NOT NULL DEFAULT 'standard',
  PRIMARY KEY (slot_id),
  CONSTRAINT chk_standard_slot_type CHECK (slot_type = 'standard'),
  CONSTRAINT fk_standard_slot FOREIGN KEY (slot_id, slot_type)
    REFERENCES parking_slot (slot_id, slot_type) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accessible_slot (
  slot_id    INT UNSIGNED NOT NULL,
  slot_type  ENUM('standard','accessible') NOT NULL DEFAULT 'accessible',
  PRIMARY KEY (slot_id),
  CONSTRAINT chk_accessible_slot_type CHECK (slot_type = 'accessible'),
  CONSTRAINT fk_accessible_slot FOREIGN KEY (slot_id, slot_type)
    REFERENCES parking_slot (slot_id, slot_type) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- User ----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name     VARCHAR(100) NOT NULL,
  email    VARCHAR(255) NULL,
  phone    VARCHAR(20)  NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_email (email),
  UNIQUE KEY uq_user_phone (phone)
) ENGINE=InnoDB;

-- ---------- Vehicle  (User 1 --owns-- N Vehicle, total on Vehicle) --
CREATE TABLE IF NOT EXISTS vehicle (
  vehicle_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          INT UNSIGNED NOT NULL,                       -- owns (1,1)
  registration_no  VARCHAR(20)  NOT NULL,
  vehicle_type     ENUM('two_wheeler','four_wheeler','heavy_vehicle') NOT NULL,  -- EER discriminator
  model_name       VARCHAR(60)  NULL,                           -- [UI]
  color            VARCHAR(16)  NULL,                           -- [UI]
  PRIMARY KEY (vehicle_id),
  UNIQUE KEY uq_vehicle_registration (registration_no),
  UNIQUE KEY uq_vehicle_id_type (vehicle_id, vehicle_type),
  KEY idx_vehicle_user (user_id),
  CONSTRAINT fk_vehicle_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------- EER: Vehicle d--> TwoWheeler | FourWheeler | HeavyVehicle
CREATE TABLE IF NOT EXISTS two_wheeler (
  vehicle_id    INT UNSIGNED NOT NULL,
  vehicle_type  ENUM('two_wheeler','four_wheeler','heavy_vehicle') NOT NULL DEFAULT 'two_wheeler',
  PRIMARY KEY (vehicle_id),
  CONSTRAINT chk_two_wheeler_type CHECK (vehicle_type = 'two_wheeler'),
  CONSTRAINT fk_two_wheeler FOREIGN KEY (vehicle_id, vehicle_type)
    REFERENCES vehicle (vehicle_id, vehicle_type) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS four_wheeler (
  vehicle_id    INT UNSIGNED NOT NULL,
  vehicle_type  ENUM('two_wheeler','four_wheeler','heavy_vehicle') NOT NULL DEFAULT 'four_wheeler',
  PRIMARY KEY (vehicle_id),
  CONSTRAINT chk_four_wheeler_type CHECK (vehicle_type = 'four_wheeler'),
  CONSTRAINT fk_four_wheeler FOREIGN KEY (vehicle_id, vehicle_type)
    REFERENCES vehicle (vehicle_id, vehicle_type) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS heavy_vehicle (
  vehicle_id    INT UNSIGNED NOT NULL,
  vehicle_type  ENUM('two_wheeler','four_wheeler','heavy_vehicle') NOT NULL DEFAULT 'heavy_vehicle',
  PRIMARY KEY (vehicle_id),
  CONSTRAINT chk_heavy_vehicle_type CHECK (vehicle_type = 'heavy_vehicle'),
  CONSTRAINT fk_heavy_vehicle FOREIGN KEY (vehicle_id, vehicle_type)
    REFERENCES vehicle (vehicle_id, vehicle_type) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Booking -------------------------------------------------
--   reserved in : ParkingSlot (0,N) -- Booking (1,1)
--   makes       : User        (0,N) -- Booking (1,1)
--   booked for  : Vehicle     (0,N) -- Booking (1,1)
CREATE TABLE IF NOT EXISTS booking (
  booking_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slot_id        INT UNSIGNED NOT NULL,
  user_id        INT UNSIGNED NOT NULL,
  vehicle_id     INT UNSIGNED NOT NULL,
  start_time     DATETIME(3) NOT NULL,
  end_time       DATETIME(3) NOT NULL,
  status         ENUM('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'confirmed',
  estimated_fee  DECIMAL(10,2) NOT NULL DEFAULT 0,                  -- [UI]
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), -- [UI]
  PRIMARY KEY (booking_id),
  KEY idx_booking_slot_window (slot_id, status, start_time, end_time),
  KEY idx_booking_user (user_id),
  KEY idx_booking_vehicle (vehicle_id),
  CONSTRAINT chk_booking_window CHECK (end_time > start_time),
  CONSTRAINT fk_booking_slot    FOREIGN KEY (slot_id)    REFERENCES parking_slot (slot_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_booking_user    FOREIGN KEY (user_id)    REFERENCES users (user_id)        ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_booking_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicle (vehicle_id)   ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------- ParkingSession -------------------------------------------
--   hosts    : ParkingSlot (0,N) -- ParkingSession (1,1)
--   parks in : Vehicle     (0,N) -- ParkingSession (1,1)
CREATE TABLE IF NOT EXISTS parking_session (
  session_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slot_id      INT UNSIGNED NOT NULL,
  vehicle_id   INT UNSIGNED NOT NULL,
  entry_time   DATETIME(3) NOT NULL,
  exit_time    DATETIME(3) NULL,
  hourly_rate  DECIMAL(8,2) NOT NULL,                           -- [UI] rate locked in at entry
  -- Guards: a slot / a vehicle can have at most ONE open (not yet exited) session.
  open_slot_id    INT UNSIGNED GENERATED ALWAYS AS (IF(exit_time IS NULL, slot_id, NULL)) VIRTUAL,
  open_vehicle_id INT UNSIGNED GENERATED ALWAYS AS (IF(exit_time IS NULL, vehicle_id, NULL)) VIRTUAL,
  PRIMARY KEY (session_id),
  UNIQUE KEY uq_one_open_session_per_slot (open_slot_id),
  UNIQUE KEY uq_one_open_session_per_vehicle (open_vehicle_id),
  KEY idx_session_slot (slot_id),
  KEY idx_session_vehicle (vehicle_id),
  CONSTRAINT chk_session_times CHECK (exit_time IS NULL OR exit_time >= entry_time),
  CONSTRAINT fk_session_slot    FOREIGN KEY (slot_id)    REFERENCES parking_slot (slot_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_session_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicle (vehicle_id)   ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------- Payment  (Payment (1,1) --generates-- ParkingSession (0,1))
CREATE TABLE IF NOT EXISTS payment (
  payment_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id      INT UNSIGNED NOT NULL,                        -- generates (1,1); UNIQUE => session has 0..1 payment
  amount          DECIMAL(10,2) NOT NULL,                       -- total incl. tax
  payment_status  ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  paid_at         DATETIME(3) NULL,
  receipt_number  VARCHAR(20) NULL,                             -- [UI]
  subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0,             -- [UI]
  tax             DECIMAL(10,2) NOT NULL DEFAULT 0,             -- [UI]
  payment_method  VARCHAR(40) NULL,                             -- [UI]
  PRIMARY KEY (payment_id),
  UNIQUE KEY uq_payment_session (session_id),
  UNIQUE KEY uq_payment_receipt (receipt_number),
  CONSTRAINT fk_payment_session FOREIGN KEY (session_id) REFERENCES parking_session (session_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------- Tariff (admin-editable hourly rates)  [UI] ---------------
CREATE TABLE IF NOT EXISTS tariff (
  vehicle_type  ENUM('two_wheeler','four_wheeler','heavy_vehicle') NOT NULL,
  hourly_rate   DECIMAL(8,2) NOT NULL,
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (vehicle_type),
  CONSTRAINT chk_tariff_positive CHECK (hourly_rate > 0)
) ENGINE=InnoDB;

-- ---------- View exposing the derived attribute `duration` ----------
CREATE OR REPLACE VIEW v_parking_session AS
SELECT s.session_id, s.slot_id, s.vehicle_id, s.entry_time, s.exit_time, s.hourly_rate,
       TIMESTAMPDIFF(MINUTE, s.entry_time, COALESCE(s.exit_time, UTC_TIMESTAMP(3))) AS duration_minutes
FROM parking_session s;
