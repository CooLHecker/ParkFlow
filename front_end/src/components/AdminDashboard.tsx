/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { ParkingSlot, VehicleType, Reservation, Receipt } from '../types/parking.js';
import {
  DEFAULT_TARIFFS,
  calculateParkingFee,
  formatCalmDateTime,
} from '../utils/parkingLogic.js';
import {
  Car,
  CreditCard,
  DollarSign,
  TrendingUp,
  Clock,
  FileText,
  Wrench,
  Layers,
} from 'lucide-react';
import { Rupee } from './Rupee.js';

interface AdminDashboardProps {
  slots: ParkingSlot[];
  reservations: Reservation[];
  receipts: Receipt[];
  tariffs: Record<VehicleType, number>;
  onUpdateTariffs: (newTariffs: Record<VehicleType, number>) => void;
  onGateEntry: (slotId: string, plate: string, type: VehicleType, driverName: string) => void;
  onGateExit: (slotId: string, paymentMethod: string) => void;
  onToggleSlotMaintenance: (slotId: string) => void;
  onCancelReservation: (reservationId: string) => void;
  onCheckInReservation: (reservation: Reservation) => void;
  onViewReceipt: (receipt: Receipt) => void;
  currentFloor: 'Floor 1' | 'Floor 2' | 'Floor 3';
  onChangeFloor: (floor: 'Floor 1' | 'Floor 2' | 'Floor 3') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  slots,
  reservations,
  receipts,
  tariffs,
  onUpdateTariffs,
  onGateEntry,
  onGateExit,
  onToggleSlotMaintenance,
  onCancelReservation,
  onCheckInReservation,
  onViewReceipt,
  currentFloor,
  onChangeFloor,
}) => {
  const [adminTab, setAdminTab] = useState<'overview' | 'gate_entry' | 'gate_exit' | 'tariffs' | 'reservations' | 'audit'>('overview');

  // Gate Entry Form States
  const [entryPlate, setEntryPlate] = useState<string>('');
  const [entryDriver, setEntryDriver] = useState<string>('');
  const [entryType, setEntryType] = useState<VehicleType>('car');
  const [entryFloor, setEntryFloor] = useState<'Floor 1' | 'Floor 2' | 'Floor 3'>(currentFloor);
  const [entrySlotId, setEntrySlotId] = useState<string>('');
  const [entryError, setEntryError] = useState<string>('');

  // Gate Exit Form States
  const [exitSlotId, setExitSlotId] = useState<string>('');
  const [exitPaymentMethod, setExitPaymentMethod] = useState<string>('UPI / QR Code');

  // Tariffs editing in Rupees (₹)
  const [editingTariffs, setEditingTariffs] = useState<Record<VehicleType, number>>({ ...tariffs });
  const [tariffSuccessMsg, setTariffSuccessMsg] = useState<string>('');

  const totalSlots = slots.length;
  const occupiedSlots = slots.filter((s) => s.status === 'occupied').length;
  const availableSlots = slots.filter((s) => s.status === 'available');
  const maintenanceSlots = slots.filter((s) => s.status === 'maintenance').length;
  const occupancyPercentage = Math.round((occupiedSlots / (totalSlots - maintenanceSlots || 1)) * 100);

  const totalRevenue = receipts.reduce((acc, curr) => acc + curr.totalAmount, 0);

  // Available slots for selected gate entry floor
  const floorAvailableSlots = slots.filter((s) => s.floor === entryFloor && s.status === 'available');

  // Handle Gate Entry Submit
  const handleEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEntryError('');

    if (!entryPlate.trim()) {
      setEntryError('Please enter a vehicle license plate number.');
      return;
    }

    let targetId = entrySlotId;
    if (!targetId) {
      const match = floorAvailableSlots.find((s) => {
        if (entryType === 'two-wheeler') return s.type === 'two-wheeler' || s.type === 'car';
        return s.type === 'car';
      });

      if (!match) {
        setEntryError(`No matching available slots currently open on ${entryFloor}.`);
        return;
      }
      targetId = match.id;
    }

    onGateEntry(targetId, entryPlate.trim().toUpperCase(), entryType, entryDriver.trim() || 'Visitor');
    setEntryPlate('');
    setEntryDriver('');
    setEntrySlotId('');
  };

  // Handle Gate Exit Submit
  const handleExitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitSlotId) return;
    onGateExit(exitSlotId, exitPaymentMethod);
    setExitSlotId('');
  };

  // Handle Save Tariffs
  const handleSaveTariffs = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateTariffs(editingTariffs);
    setTariffSuccessMsg('Hourly tariff rules updated successfully!');
    setTimeout(() => setTariffSuccessMsg(''), 4000);
  };

  // Current session calculation for exit preview in Rupees (₹)
  const exitSlot = slots.find((s) => s.id === exitSlotId);
  const exitPreviewFee =
    exitSlot && exitSlot.currentVehicle
      ? calculateParkingFee(exitSlot.currentVehicle.entryTime, Date.now(), exitSlot.currentVehicle.hourlyTariff)
      : null;

  return (
    <div className="w-full space-y-6">
      {/* Admin KPI Header Cards in Rupees (₹) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-stone-200/90 shadow-xs">
          <span className="text-xs text-stone-500 font-medium">Occupancy Rate</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-outfit font-bold text-stone-900">{occupancyPercentage}%</span>
            <span className="text-xs font-semibold text-rose-700">
              {occupiedSlots} / {totalSlots} slots
            </span>
          </div>
          <div className="w-full bg-stone-100 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-[#FFB7B2] h-full rounded-full transition-all duration-500"
              style={{ width: `${occupancyPercentage}%` }}
            ></div>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-stone-200/90 shadow-xs">
          <span className="text-xs text-stone-500 font-medium">Available Free Slots</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-outfit font-bold text-emerald-700">{availableSlots.length}</span>
            <span className="text-xs text-stone-500">Across 3 floors</span>
          </div>
          <p className="text-[11px] text-stone-400 mt-2 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Live gate capacity normal
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-stone-200/90 shadow-xs">
          <span className="text-xs text-stone-500 font-medium">Advance Bookings</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-outfit font-bold text-purple-800">{reservations.length}</span>
            <span className="text-xs text-purple-700">Scheduled</span>
          </div>
          <p className="text-[11px] text-stone-400 mt-2">No overlapping conflicts</p>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-stone-200/90 shadow-xs">
          <span className="text-xs text-stone-500 font-medium">Total Session Revenue</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-outfit font-bold text-[#292524] flex items-center">
              <Rupee className="mr-0.5" />
              {totalRevenue.toFixed(2)}
            </span>
            <span className="text-xs text-emerald-700 font-semibold">{receipts.length} paid</span>
          </div>
          <p className="text-[11px] text-stone-400 mt-2">Automated billing active</p>
        </div>
      </div>

      {/* Admin Nav Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white/80 p-2 rounded-3xl border border-stone-200/80 shadow-xs backdrop-blur-xs">
        {[
          { id: 'overview', label: 'Operations Overview', icon: TrendingUp },
          { id: 'gate_entry', label: 'Gate Entry (Check-In)', icon: Car },
          { id: 'gate_exit', label: 'Gate Exit & Billing', icon: CreditCard },
          { id: 'tariffs', label: 'Tariffs & Rates', icon: DollarSign },
          { id: 'reservations', label: 'Reservations Ledger', icon: Clock },
          { id: 'audit', label: 'Session Receipts & Audit', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = adminTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setAdminTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#292524] text-white font-semibold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OPERATIONS OVERVIEW & SLOT MATRIX */}
      {adminTab === 'overview' && (
        <div className="bg-white rounded-4xl p-6 sm:p-8 border border-stone-200/80 shadow-sm animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-stone-100 gap-4">
            <div>
              <span className="font-handwriting text-2xl text-stone-500 block mb-1">
                parking slot controller
              </span>
              <h3 className="font-outfit text-2xl font-bold text-stone-900">
                Slot Inventory & Maintenance Controls
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Toggle slot status, set maintenance closures, or view parked vehicles across all 3 floors.
              </p>
            </div>

            {/* Floor selector for admin inventory */}
            <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-full border border-stone-200">
              {(['Floor 1', 'Floor 2', 'Floor 3'] as const).map((fl) => (
                <button
                  key={fl}
                  onClick={() => onChangeFloor(fl)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    currentFloor === fl ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {fl}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {slots
              .filter((s) => s.floor === currentFloor)
              .map((slot) => (
                <div
                  key={slot.id}
                  className="p-4 rounded-3xl border border-stone-200 bg-stone-50/60 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg text-stone-900">{slot.label}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-700">
                        {slot.type}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          slot.status === 'available'
                            ? 'bg-emerald-100 text-emerald-800'
                            : slot.status === 'occupied'
                            ? 'bg-[#FFB7B2] text-rose-950'
                            : slot.status === 'reserved'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-stone-200 text-stone-600'
                        }`}
                      >
                        {slot.status}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      {slot.currentVehicle ? (
                        <>
                          Parked: <span className="font-mono font-semibold text-stone-900">{slot.currentVehicle.plate}</span> (
                          {slot.currentVehicle.vehicleType})
                        </>
                      ) : (
                        'Slot is currently empty'
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleSlotMaintenance(slot.id)}
                      className="p-2 rounded-xl border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 transition-colors text-xs flex items-center gap-1"
                      title="Toggle Maintenance"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {slot.status === 'maintenance' ? 'Open' : 'Close'}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 2: GATE ENTRY (CHECK-IN) */}
      {adminTab === 'gate_entry' && (
        <div className="bg-white rounded-4xl p-6 sm:p-8 border border-stone-200/80 shadow-sm animate-in fade-in duration-300">
          <div className="max-w-2xl">
            <span className="font-handwriting text-2xl text-stone-500 block mb-1">
              entrance gate console
            </span>
            <h3 className="font-outfit text-2xl font-bold text-stone-900 mb-2">
              Vehicle Inbound Gate Check-In
            </h3>
            <p className="text-xs text-stone-500 mb-6">
              Grant barrier clearance, record plate number, and dispatch the car smoothly into its allocated slot.
            </p>

            <form onSubmit={handleEntrySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Select Floor
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Floor 1', 'Floor 2', 'Floor 3'] as const).map((fl) => (
                    <button
                      key={fl}
                      type="button"
                      onClick={() => {
                        setEntryFloor(fl);
                        setEntrySlotId('');
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                        entryFloor === fl
                          ? 'border-stone-900 bg-[#292524] text-white shadow-xs'
                          : 'border-stone-200 bg-stone-50 hover:bg-white text-stone-700'
                      }`}
                    >
                      {fl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    License Plate <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MH-04-AX-5522"
                    value={entryPlate}
                    onChange={(e) => setEntryPlate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 font-mono text-sm uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Driver / Guest Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vikram Malhotra"
                    value={entryDriver}
                    onChange={(e) => setEntryDriver(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Vehicle Classification
                  </label>
                  <select
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as VehicleType)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                  >
                    <option value="car">Car (₹{tariffs.car || DEFAULT_TARIFFS.car}/hr)</option>
                    <option value="two-wheeler">2-Wheeler (₹{tariffs['two-wheeler'] || DEFAULT_TARIFFS['two-wheeler']}/hr)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Target Slot on {entryFloor}
                  </label>
                  <select
                    value={entrySlotId}
                    onChange={(e) => setEntrySlotId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                  >
                    <option value="">⚡ Auto-assign closest available slot on {entryFloor}</option>
                    {floorAvailableSlots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} ({s.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {entryError && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {entryError}
                </p>
              )}

              <button
                type="submit"
                className="py-3 px-6 rounded-full bg-[#292524] text-white font-bold text-xs hover:bg-stone-800 transition-colors shadow-md flex items-center gap-2"
              >
                <Car className="w-4 h-4 text-[#FFB7B2]" />
                Open Entrance Barrier & Park Vehicle
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: GATE EXIT & BILLING */}
      {adminTab === 'gate_exit' && (
        <div className="bg-white rounded-4xl p-6 sm:p-8 border border-stone-200/80 shadow-sm animate-in fade-in duration-300">
          <div className="max-w-2xl">
            <span className="font-handwriting text-2xl text-stone-500 block mb-1">
              exit barrier checkout
            </span>
            <h3 className="font-outfit text-2xl font-bold text-stone-900 mb-2">
              Outbound Gate & Automated Billing
            </h3>
            <p className="text-xs text-stone-500 mb-6">
              Select parked vehicle, automatically compute duration and tariffs in Rupees (₹), collect tender, and dispatch off-lot.
            </p>

            {occupiedSlots === 0 ? (
              <div className="p-8 text-center bg-stone-50 rounded-3xl border border-stone-200/70 text-stone-400">
                <Car className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                <p className="text-xs font-medium text-stone-600">No vehicles are currently parked on the lot.</p>
              </div>
            ) : (
              <form onSubmit={handleExitSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Select Parked Vehicle / Slot to Check Out:
                  </label>
                  <select
                    value={exitSlotId}
                    onChange={(e) => setExitSlotId(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                  >
                    <option value="">-- Choose active slot --</option>
                    {slots
                      .filter((s) => s.status === 'occupied' && s.currentVehicle)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.floor} • {s.label} • {s.currentVehicle?.plate} ({s.currentVehicle?.vehicleType})
                        </option>
                      ))}
                  </select>
                </div>

                {exitSlot && exitSlot.currentVehicle && exitPreviewFee && (
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2 text-xs">
                    <div className="flex justify-between text-stone-600">
                      <span>Vehicle:</span>
                      <span className="font-mono font-bold text-stone-900">
                        {exitSlot.currentVehicle.plate}
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Location:</span>
                      <span className="font-semibold text-stone-800">
                        {exitSlot.floor} • {exitSlot.label}
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Duration:</span>
                      <span className="font-semibold text-stone-900">
                        {exitPreviewFee.durationFormatted} ({exitPreviewFee.billableHours} billable hrs)
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Tariff Rate:</span>
                      <span className="flex items-center"><Rupee className="mr-0.5" />{exitSlot.currentVehicle.hourlyTariff.toFixed(2)}/hr</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Subtotal:</span>
                      <span className="flex items-center"><Rupee className="mr-0.5" />{exitPreviewFee.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Tax (8%):</span>
                      <span className="flex items-center"><Rupee className="mr-0.5" />{exitPreviewFee.tax.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t border-stone-200 flex justify-between items-center text-stone-900 font-bold text-sm">
                      <span>Total Due:</span>
                      <span className="text-xl text-[#292524] flex items-center">
                        <Rupee className="mr-0.5" />{exitPreviewFee.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['UPI / QR Code', 'Cash', 'Credit / Debit Card'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setExitPaymentMethod(m)}
                        className={`py-2 px-3 rounded-xl border text-xs font-medium text-center transition-all ${
                          exitPaymentMethod === m
                            ? 'bg-[#292524] text-white border-stone-900'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!exitSlotId}
                  className="w-full py-3.5 px-6 rounded-full bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors shadow-md disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Accept Payment (₹), Open Exit Gate & Drive Car Out
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TARIFFS & HOURLY RATES IN RUPEES (₹) */}
      {adminTab === 'tariffs' && (
        <div className="bg-white rounded-4xl p-6 sm:p-8 border border-stone-200/80 shadow-sm animate-in fade-in duration-300">
          <div className="max-w-2xl">
            <span className="font-handwriting text-2xl text-stone-500 block mb-1">
              pricing rulebook
            </span>
            <h3 className="font-outfit text-2xl font-bold text-stone-900 mb-2">
              Vehicle-Specific Hourly Tariffs (in ₹ Rupees)
            </h3>
            <p className="text-xs text-stone-500 mb-6">
              Configure rates per vehicle category in Rupees. Applied automatically to all future parking sessions.
            </p>

            <form onSubmit={handleSaveTariffs} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Car Tariff Rate (₹/hr)
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="10"
                    value={editingTariffs.car ?? 50}
                    onChange={(e) =>
                      setEditingTariffs({ ...editingTariffs, car: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Two-Wheeler / Bike (₹/hr)
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="5"
                    value={editingTariffs['two-wheeler'] ?? 20}
                    onChange={(e) =>
                      setEditingTariffs({
                        ...editingTariffs,
                        'two-wheeler': parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                  />
                </div>
              </div>

              {tariffSuccessMsg && (
                <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  {tariffSuccessMsg}
                </p>
              )}

              <button
                type="submit"
                className="py-3 px-6 rounded-full bg-[#292524] text-white font-bold text-xs hover:bg-stone-800 transition-colors shadow-xs"
              >
                Save Tariff Rules (₹)
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 5: RESERVATIONS LEDGER */}
      {adminTab === 'reservations' && (
        <div className="bg-white rounded-4xl p-6 sm:p-8 border border-stone-200/80 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div>
              <span className="font-handwriting text-2xl text-stone-500 block mb-1">
                booking schedule
              </span>
              <h3 className="font-outfit text-2xl font-bold text-stone-900">
                Advance Bookings Master Ledger
              </h3>
            </div>
            <span className="text-xs bg-purple-100 text-purple-900 px-3 py-1 rounded-full font-bold">
              {reservations.length} Records
            </span>
          </div>

          {reservations.length === 0 ? (
            <div className="p-10 text-center text-stone-400 text-xs">
              No advance reservations currently booked.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-400 uppercase font-semibold">
                    <th className="pb-3">Slot & Floor</th>
                    <th className="pb-3">Driver</th>
                    <th className="pb-3">Plate & Type</th>
                    <th className="pb-3">Reserved Schedule</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {reservations.map((res) => (
                    <tr key={res.id} className="hover:bg-stone-50/60">
                      <td className="py-3 font-mono font-bold text-stone-900">
                        {res.slotLabel} ({res.floor})
                      </td>
                      <td className="py-3 font-medium text-stone-800">{res.driverName}</td>
                      <td className="py-3">
                        <span className="font-mono">{res.vehiclePlate}</span> ({res.vehicleType})
                      </td>
                      <td className="py-3 text-stone-600">
                        {formatCalmDateTime(res.startTime)} → {formatCalmDateTime(res.endTime)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold uppercase text-[10px] ${
                            res.status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : res.status === 'cancelled'
                              ? 'bg-stone-100 text-stone-500 line-through'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {res.status}
                        </span>
                      </td>
                      <td className="py-3 text-right space-x-2">
                        {res.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => onCheckInReservation(res)}
                              className="px-2.5 py-1 rounded-full bg-stone-900 text-white font-medium text-[10px] hover:bg-stone-800"
                            >
                              Check In
                            </button>
                            <button
                              onClick={() => onCancelReservation(res.id)}
                              className="px-2.5 py-1 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px]"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: AUDIT & RECEIPTS */}
      {adminTab === 'audit' && (
        <div className="bg-white rounded-4xl p-6 sm:p-8 border border-stone-200/80 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div>
              <span className="font-handwriting text-2xl text-stone-500 block mb-1">
                financial records
              </span>
              <h3 className="font-outfit text-2xl font-bold text-stone-900">
                Completed Sessions & Tax Invoices (in ₹ Rupees)
              </h3>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-stone-400 block uppercase font-bold">Total Invoiced</span>
              <span className="text-xl font-bold text-[#292524] flex items-center justify-end">
                <Rupee className="mr-0.5" />
                {totalRevenue.toFixed(2)}
              </span>
            </div>
          </div>

          {receipts.length === 0 ? (
            <div className="p-10 text-center text-stone-400 text-xs">
              No sessions completed yet. Check out a vehicle to generate audit receipts.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-400 uppercase font-semibold">
                    <th className="pb-3">Receipt #</th>
                    <th className="pb-3">Slot & Floor</th>
                    <th className="pb-3">Vehicle Plate</th>
                    <th className="pb-3">Duration</th>
                    <th className="pb-3">Payment</th>
                    <th className="pb-3 text-right">Amount</th>
                    <th className="pb-3 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {receipts.map((rec) => (
                    <tr key={rec.id} className="hover:bg-stone-50/60">
                      <td className="py-3 font-mono font-bold text-stone-900">#{rec.receiptNumber}</td>
                      <td className="py-3 font-mono">{rec.slotLabel} ({rec.floor})</td>
                      <td className="py-3 font-mono uppercase">{rec.vehiclePlate}</td>
                      <td className="py-3 text-stone-600">{rec.durationFormatted}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded bg-stone-100 font-mono text-[10px]">
                          {rec.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold text-stone-900">
                        <span className="flex items-center justify-end"><Rupee className="mr-0.5" />{rec.totalAmount.toFixed(2)}</span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => onViewReceipt(rec)}
                          className="text-stone-700 hover:text-stone-900 font-semibold underline text-[11px]"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
