/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VehicleType = 'car' | 'two-wheeler';

export type SlotStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

export interface VehicleInfo {
  plate: string;
  modelName: string;
  vehicleType: VehicleType;
  color: string;
  entryTime: number;
  hourlyTariff: number; // in Rupees ₹
}

export interface ParkingSlot {
  id: string;
  label: string;
  floor: 'Floor 1' | 'Floor 2' | 'Floor 3';
  floorNumber: 1 | 2 | 3;
  type: 'car' | 'two-wheeler';
  status: SlotStatus;
  currentVehicle?: VehicleInfo;
  row: number; // 0 = upper row, 1 = lower row
  col: number; // 0..4
}

export interface Reservation {
  id: string;
  slotId: string;
  slotLabel: string;
  floor: string;
  vehiclePlate: string;
  vehicleType: VehicleType;
  driverName: string;
  contactNumber: string;
  startTime: number;
  endTime: number;
  estimatedFee: number; // in Rupees ₹
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: number;
}

export interface ParkingSession {
  id: string;
  slotId: string;
  slotLabel: string;
  floor: string;
  vehiclePlate: string;
  vehicleType: VehicleType;
  entryTime: number;
  exitTime?: number;
  hourlyTariff: number; // in Rupees ₹
  paymentStatus: 'unpaid' | 'paid';
  totalFee?: number; // in Rupees ₹
  paymentMethod?: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  slotLabel: string;
  floor: string;
  vehiclePlate: string;
  vehicleType: VehicleType;
  entryTime: number;
  exitTime: number;
  durationFormatted: string;
  durationMinutes: number;
  hourlyTariff: number; // in Rupees ₹
  subtotal: number; // in Rupees ₹
  tax: number; // in Rupees ₹
  totalAmount: number; // in Rupees ₹
  paymentMethod: string;
  paymentStatus: 'paid';
  issuedAt: number;
}

export interface TariffRate {
  vehicleType: VehicleType;
  label: string;
  hourlyRate: number; // in Rupees ₹
  description: string;
  color: string;
}
