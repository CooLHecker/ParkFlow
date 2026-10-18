/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VehicleType, TariffRate, ParkingSlot, Reservation, Receipt } from '../types/parking.js';

export const DEFAULT_TARIFFS: Record<VehicleType, number> = {
  car: 50.0,
  'two-wheeler': 20.0,
};

export const TARIFF_DETAILS: TariffRate[] = [
  {
    vehicleType: 'car',
    label: 'Car',
    hourlyRate: 50.0,
    description: 'Hatchbacks, sedans, and SUVs',
    color: '#E8EFE8', // Soft Sage
  },
  {
    vehicleType: 'two-wheeler',
    label: 'Two-Wheeler',
    hourlyRate: 20.0,
    description: 'Motorcycles, bikes, and scooters',
    color: '#F4ECE1', // Warm Sand
  },
];

/**
 * Calculates parking fee in Rupees (₹) based on entry and exit timestamps.
 * Minimum billable duration is 1 hour, then billed pro-rata per 30-min block.
 * Includes 8% service tax.
 */
export function calculateParkingFee(
  entryTime: number,
  exitTime: number,
  hourlyTariff: number,
  taxRate: number = 0.08
): {
  durationMinutes: number;
  durationFormatted: string;
  billableHours: number;
  subtotal: number;
  tax: number;
  total: number;
} {
  const diffMs = Math.max(0, exitTime - entryTime);
  const totalMinutes = Math.max(1, Math.ceil(diffMs / (1000 * 60)));

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const durationFormatted = `${hours > 0 ? `${hours}h ` : ''}${minutes}m`;

  // Minimum 1 hour charge, then charged per 30-min block
  const billableHours = Math.max(1, Math.ceil(totalMinutes / 30) * 0.5);
  const rawSubtotal = billableHours * hourlyTariff;
  const subtotal = Math.round(rawSubtotal * 100) / 100;
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  return {
    durationMinutes: totalMinutes,
    durationFormatted,
    billableHours,
    subtotal,
    tax,
    total,
  };
}

/**
 * Checks whether two time intervals [startA, endA) and [startB, endB) overlap.
 */
export function isTimeOverlapping(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return Math.max(startA, startB) < Math.min(endA, endB);
}

/**
 * Checks if a parking slot is available for advance reservation during requested time window.
 */
export function isSlotAvailableForReservation(
  slotId: string,
  reservations: Reservation[],
  requestedStart: number,
  requestedEnd: number,
  excludeReservationId?: string
): { available: boolean; conflict?: Reservation } {
  if (requestedEnd <= requestedStart) {
    return { available: false };
  }

  const conflicting = reservations.find((r) => {
    if (r.slotId !== slotId) return false;
    if (r.id === excludeReservationId) return false;
    if (r.status === 'cancelled' || r.status === 'completed') return false;
    return isTimeOverlapping(requestedStart, requestedEnd, r.startTime, r.endTime);
  });

  if (conflicting) {
    return { available: false, conflict: conflicting };
  }

  return { available: true };
}

/**
 * Finds all slots matching vehicle type.
 */
export function getAvailableSlotsForVehicle(
  slots: ParkingSlot[],
  vehicleType: VehicleType
): ParkingSlot[] {
  return slots.filter((slot) => {
    if (slot.status !== 'available') return false;
    if (vehicleType === 'car') return slot.type === 'car';
    if (vehicleType === 'two-wheeler') return slot.type === 'two-wheeler' || slot.type === 'car';
    return true;
  });
}

/**
 * Generates an official receipt in Rupees (₹) for a completed parking session.
 */
export function createParkingReceipt(
  slotLabel: string,
  floor: string,
  vehiclePlate: string,
  vehicleType: VehicleType,
  entryTime: number,
  exitTime: number,
  hourlyTariff: number,
  paymentMethod: string
): Receipt {
  const fee = calculateParkingFee(entryTime, exitTime, hourlyTariff);
  const id = `REC-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

  return {
    id,
    receiptNumber: `SP-${Math.floor(100000 + Math.random() * 900000)}`,
    slotLabel,
    floor,
    vehiclePlate: vehiclePlate.toUpperCase(),
    vehicleType,
    entryTime,
    exitTime,
    durationFormatted: fee.durationFormatted,
    durationMinutes: fee.durationMinutes,
    hourlyTariff,
    subtotal: fee.subtotal,
    tax: fee.tax,
    totalAmount: fee.total,
    paymentMethod,
    paymentStatus: 'paid',
    issuedAt: Date.now(),
  };
}

/**
 * Formats timestamps into calm human-readable date & time strings.
 */
export function formatCalmDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatCalmTimeOnly(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
