import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateParkingFee,
  isTimeOverlapping,
  isSlotAvailableForReservation,
  createParkingReceipt,
} from './parkingLogic.ts';
import type { Reservation } from '../types/parking.ts';

test('calculateParkingFee computes correct billing in Rupees for 1 hour minimum', () => {
  const entry = 1000000;
  const exit = entry + 20 * 60 * 1000; // 20 minutes
  const fee = calculateParkingFee(entry, exit, 50.0); // ₹50/hr

  assert.equal(fee.billableHours, 1);
  assert.equal(fee.subtotal, 50.0);
  assert.equal(fee.tax, 4.0); // 8% of ₹50
  assert.equal(fee.total, 54.0);
});

test('calculateParkingFee computes 2.5 hours in Rupees correctly', () => {
  const entry = 1000000;
  const exit = entry + (2 * 60 + 25) * 60 * 1000; // 2h 25m -> 2.5 billable hours
  const fee = calculateParkingFee(entry, exit, 60.0); // Sedan rate ₹60/hr

  assert.equal(fee.billableHours, 2.5);
  assert.equal(fee.subtotal, 150.0);
  assert.equal(fee.tax, 12.0);
  assert.equal(fee.total, 162.0);
});

test('isTimeOverlapping correctly detects conflicting and non-conflicting time ranges', () => {
  const startA = 1000;
  const endA = 2000;

  // Fully inside
  assert.equal(isTimeOverlapping(startA, endA, 1200, 1800), true);
  // Overlapping left
  assert.equal(isTimeOverlapping(startA, endA, 800, 1500), true);
  // Overlapping right
  assert.equal(isTimeOverlapping(startA, endA, 1500, 2500), true);
  // Adjacent
  assert.equal(isTimeOverlapping(startA, endA, 2000, 3000), false);
  assert.equal(isTimeOverlapping(startA, endA, 500, 1000), false);
});

test('isSlotAvailableForReservation flags conflicts and ignores cancelled bookings', () => {
  const mockReservations: Reservation[] = [
    {
      id: 'res-1',
      slotId: 'A1',
      slotLabel: 'Slot A1',
      floor: 'Floor 1',
      vehiclePlate: 'MH-02-AB-1234',
      vehicleType: 'car',
      driverName: 'Alice',
      contactNumber: '9876543210',
      startTime: 10000,
      endTime: 20000,
      estimatedFee: 120,
      status: 'confirmed',
      createdAt: 5000,
    },
    {
      id: 'res-2',
      slotId: 'A1',
      slotLabel: 'Slot A1',
      floor: 'Floor 1',
      vehiclePlate: 'MH-04-XY-9876',
      vehicleType: 'car',
      driverName: 'Bob',
      contactNumber: '9876543211',
      startTime: 30000,
      endTime: 40000,
      estimatedFee: 80,
      status: 'cancelled',
      createdAt: 5000,
    },
  ];

  // Overlaps with res-1 on Slot A1
  const check1 = isSlotAvailableForReservation('A1', mockReservations, 15000, 25000);
  assert.equal(check1.available, false);
  assert.equal(check1.conflict?.id, 'res-1');

  // Same time but different slot -> Available
  const check2 = isSlotAvailableForReservation('B1', mockReservations, 15000, 25000);
  assert.equal(check2.available, true);

  // Overlaps with cancelled res-2 -> Available
  const check3 = isSlotAvailableForReservation('A1', mockReservations, 32000, 38000);
  assert.equal(check3.available, true);
});

test('createParkingReceipt generates consistent receipt metadata in Rupees', () => {
  const entry = 1700000000000;
  const exit = entry + 90 * 60 * 1000; // 1.5 hours
  const receipt = createParkingReceipt('Slot A3', 'Floor 1', 'MH-12-CD-5678', 'car', entry, exit, 50.0, 'UPI');

  assert.equal(receipt.slotLabel, 'Slot A3');
  assert.equal(receipt.floor, 'Floor 1');
  assert.equal(receipt.vehiclePlate, 'MH-12-CD-5678');
  assert.equal(receipt.vehicleType, 'car');
  assert.equal(receipt.paymentStatus, 'paid');
  assert.equal(receipt.paymentMethod, 'UPI');
  assert.ok(receipt.totalAmount > 0);
  assert.ok(receipt.receiptNumber.startsWith('SP-'));
});
