import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateParkingFee } from '../src/fee.js';

// Mirrors front_end/src/utils/parkingLogic.test.ts so server and UI agree on billing.
test('20 minutes is billed as the 1-hour minimum (₹50/h + 8% tax)', () => {
  const fee = calculateParkingFee(1_000_000, 1_000_000 + 20 * 60_000, 50);
  assert.equal(fee.billableHours, 1);
  assert.equal(fee.subtotal, 50);
  assert.equal(fee.tax, 4);
  assert.equal(fee.total, 54);
});

test('2h25m is billed as 2.5 hours', () => {
  const fee = calculateParkingFee(1_000_000, 1_000_000 + (2 * 60 + 25) * 60_000, 60);
  assert.equal(fee.billableHours, 2.5);
  assert.equal(fee.subtotal, 150);
  assert.equal(fee.tax, 12);
  assert.equal(fee.total, 162);
});

test('duration formatting and zero-length stays', () => {
  assert.equal(calculateParkingFee(0, 125 * 60_000, 20).durationFormatted, '2h 5m');
  const zero = calculateParkingFee(5000, 5000, 20);
  assert.equal(zero.durationMinutes, 1);
  assert.equal(zero.total, 21.6);
});
