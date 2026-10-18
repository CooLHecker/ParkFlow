/**
 * Thin client for the ParkFlow backend (back_end/). All state lives in the
 * Aiven-hosted MySQL database; the browser only renders what the API returns.
 *
 * In development Vite proxies /api -> http://localhost:4000 (see vite.config.ts).
 * In production set VITE_API_URL to the deployed backend origin.
 */
import type { ParkingSlot, Reservation, Receipt, VehicleType } from './types/parking.js';

const BASE: string = ((import.meta as any).env?.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the ParkFlow server. Is the backend running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  return data as T;
}

export interface AppState {
  slots: ParkingSlot[];
  reservations: Reservation[];
  receipts: Receipt[];
  tariffs: Record<VehicleType, number>;
}

export interface NewReservation {
  slotId: string;
  plate: string;
  vehicleType: VehicleType;
  driverName: string;
  contactNumber: string;
  startTime: number;
  endTime: number;
}

export const api = {
  getState: () => request<AppState>('GET', '/state'),
  parkVehicle: (slotId: string, plate: string, vehicleType: VehicleType) =>
    request<ParkingSlot>('POST', '/sessions/entry', { slotId, plate, vehicleType }),
  exitVehicle: (slotId: string, paymentMethod: string) =>
    request<Receipt>('POST', '/sessions/exit', { slotId, paymentMethod }),
  createReservation: (r: NewReservation) => request<Reservation>('POST', '/reservations', r),
  cancelReservation: (id: string) => request<Reservation>('POST', `/reservations/${id}/cancel`),
  checkInReservation: (id: string) =>
    request<{ slot: ParkingSlot; reservation: Reservation }>('POST', `/reservations/${id}/check-in`),
  toggleMaintenance: (slotId: string) => request<ParkingSlot>('PATCH', `/slots/${slotId}/maintenance`),
  updateTariffs: (tariffs: Partial<Record<VehicleType, number>>) =>
    request<Record<VehicleType, number>>('PUT', '/tariffs', tariffs),
};
