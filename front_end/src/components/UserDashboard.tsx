/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { ParkingSlot, VehicleType, Reservation, Receipt } from '../types/parking.js';
import {
  DEFAULT_TARIFFS,
  TARIFF_DETAILS,
  calculateParkingFee,
  isSlotAvailableForReservation,
  formatCalmDateTime,
} from '../utils/parkingLogic.js';
import {
  Calendar,
  Clock,
  Car,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  FileText,
  Layers,
} from 'lucide-react';
import { Rupee } from './Rupee.js';

interface UserDashboardProps {
  slots: ParkingSlot[];
  reservations: Reservation[];
  receipts: Receipt[];
  onParkNow: (slotId: string, plate: string, type: VehicleType, driverName: string) => void;
  onCreateReservation: (
    slotId: string,
    plate: string,
    type: VehicleType,
    driverName: string,
    contact: string,
    start: number,
    end: number,
    estimatedFee: number
  ) => void;
  onCancelReservation: (reservationId: string) => void;
  onExitVehicle: (slotId: string, paymentMethod: string) => void;
  onViewReceipt: (receipt: Receipt) => void;
  preselectedSlotId?: string | null;
  currentFloor: 'Floor 1' | 'Floor 2' | 'Floor 3';
  onChangeFloor: (floor: 'Floor 1' | 'Floor 2' | 'Floor 3') => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  slots,
  reservations,
  receipts,
  onParkNow,
  onCreateReservation,
  onCancelReservation,
  onExitVehicle,
  onViewReceipt,
  preselectedSlotId,
  currentFloor,
  onChangeFloor,
}) => {
  const [activeTab, setActiveTab] = useState<'park_now' | 'reserve' | 'active_ticket' | 'receipts'>('park_now');

  // Form states for Park Now
  const [quickPlate, setQuickPlate] = useState<string>('');
  const [quickDriver, setQuickDriver] = useState<string>('');
  const [quickType, setQuickType] = useState<VehicleType>('car');
  const [quickSlotId, setQuickSlotId] = useState<string>(preselectedSlotId || '');
  const [quickFloor, setQuickFloor] = useState<'Floor 1' | 'Floor 2' | 'Floor 3'>(currentFloor);
  const [quickError, setQuickError] = useState<string>('');

  // Form states for Advance Reservation
  const [resDate, setResDate] = useState<string>(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [resStartHour, setResStartHour] = useState<string>('14:00');
  const [resDurationHours, setResDurationHours] = useState<number>(2);
  const [resPlate, setResPlate] = useState<string>('');
  const [resDriver, setResDriver] = useState<string>('');
  const [resContact, setResContact] = useState<string>('');
  const [resType, setResType] = useState<VehicleType>('car');
  const [resFloor, setResFloor] = useState<'Floor 1' | 'Floor 2' | 'Floor 3'>('Floor 1');
  const [resSlotId, setResSlotId] = useState<string>('');
  const [resError, setResError] = useState<string>('');
  const [resSuccess, setResSuccess] = useState<string>('');

  // Find currently active user parked vehicle (if any)
  const activeOccupiedSlot = slots.find((s) => s.status === 'occupied' && s.currentVehicle);

  const availableSlotsForQuick = slots.filter(
    (s) => s.floor === quickFloor && s.status === 'available'
  );

  const availableSlotsForRes = slots.filter(
    (s) => s.floor === resFloor
  );

  // Handle Quick Park Now
  const handleQuickPark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPlate.trim()) {
      setQuickError('Please enter your vehicle license plate number.');
      return;
    }

    let targetSlotId = quickSlotId;
    if (!targetSlotId) {
      // Auto-assign first compatible available slot on selected floor
      const autoSlot = availableSlotsForQuick.find((s) => {
        if (quickType === 'two-wheeler') return s.type === 'two-wheeler' || s.type === 'car';
        return s.type === 'car';
      });

      if (!autoSlot) {
        setQuickError(`Sorry, no matching available parking slots right now on ${quickFloor}.`);
        return;
      }
      targetSlotId = autoSlot.id;
    }

    const chosenSlot = slots.find((s) => s.id === targetSlotId);
    if (!chosenSlot || chosenSlot.status !== 'available') {
      setQuickError('This slot was just allocated or is unavailable. Please select another slot.');
      return;
    }

    setQuickError('');
    onParkNow(targetSlotId, quickPlate.trim().toUpperCase(), quickType, quickDriver.trim() || 'Driver');
    setQuickPlate('');
    setQuickDriver('');
  };

  // Handle Advance Reservation
  const handleReserveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResError('');
    setResSuccess('');

    if (!resPlate.trim() || !resDriver.trim()) {
      setResError('Please provide your vehicle plate and driver name.');
      return;
    }

    const targetSlot = resSlotId || availableSlotsForRes[0]?.id;
    if (!targetSlot) {
      setResError('Please choose a valid parking slot.');
      return;
    }

    // Calculate timestamps
    const [hours, minutes] = resStartHour.split(':').map(Number);
    const startDate = new Date(resDate);
    startDate.setHours(hours, minutes, 0, 0);
    const startTime = startDate.getTime();
    const endTime = startTime + resDurationHours * 3600 * 1000;

    if (startTime < Date.now()) {
      setResError('Reservation start time must be in the future.');
      return;
    }

    // Overlap prevention check
    const availabilityCheck = isSlotAvailableForReservation(targetSlot, reservations, startTime, endTime);
    if (!availabilityCheck.available) {
      const conflict = availabilityCheck.conflict;
      const conflictMsg = conflict
        ? `Slot ${targetSlot} on ${resFloor} is already booked from ${formatCalmDateTime(conflict.startTime)} to ${formatCalmDateTime(conflict.endTime)}.`
        : `Slot ${targetSlot} has a schedule conflict.`;
      setResError(`${conflictMsg} Please choose another slot or adjust your time.`);
      return;
    }

    const hourlyRate = DEFAULT_TARIFFS[resType];
    const estimatedFee = hourlyRate * resDurationHours * 1.08; // including 8% tax

    onCreateReservation(
      targetSlot,
      resPlate.trim().toUpperCase(),
      resType,
      resDriver.trim(),
      resContact.trim() || 'N/A',
      startTime,
      endTime,
      Math.round(estimatedFee * 100) / 100
    );

    setResSuccess(`Booking confirmed! Slot ${targetSlot} on ${resFloor} is reserved for you.`);
    setResPlate('');
    setResContact('');
  };

  return (
    <div className="w-full space-y-6">
      {/* Sub Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 p-2 rounded-3xl border border-stone-200/80 shadow-xs backdrop-blur-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'park_now', label: 'Park My Car Now', icon: Car },
            { id: 'reserve', label: 'Reserve in Advance', icon: Calendar },
            { id: 'active_ticket', label: 'My Active Ticket', icon: Clock },
            { id: 'receipts', label: 'My Receipts', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#FFB7B2] text-stone-900 font-semibold shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-2 pr-3 text-xs text-stone-500">
          <Layers className="w-4 h-4 text-stone-600" />
          <span>3 Floors Available</span>
        </div>
      </div>

      {/* TAB 1: PARK MY CAR NOW */}
      {activeTab === 'park_now' && (
        <div className="bg-white rounded-4xl p-6 sm:p-8 border border-stone-200/80 shadow-sm animate-in fade-in duration-300">
          <div className="max-w-2xl">
            <span className="font-handwriting text-2xl text-stone-500 block mb-1">
              seamless automated entry
            </span>
            <h3 className="font-outfit text-3xl font-bold text-[#292524] tracking-tight">
              Allocate a Parking Slot
            </h3>
            <p className="text-sm text-[#78716C] mt-1 mb-6">
              Enter your vehicle details. As soon as you confirm, your car will automatically navigate and park itself in the allocated slot!
            </p>

            <form onSubmit={handleQuickPark} className="space-y-5">
              {/* Floor Selection */}
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
                        setQuickFloor(fl);
                        onChangeFloor(fl);
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                        quickFloor === fl
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
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Vehicle License Plate <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MH-02-CD-4567"
                    value={quickPlate}
                    onChange={(e) => setQuickPlate(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 font-mono text-base uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Driver Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Sharma"
                    value={quickDriver}
                    onChange={(e) => setQuickDriver(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                  />
                </div>
              </div>

              {/* Vehicle Type Selector with Tariffs in Rupees (₹) */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-2">
                  Select Vehicle Type & Hourly Tariff (in ₹)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {TARIFF_DETAILS.map((t) => (
                    <div
                      key={t.vehicleType}
                      onClick={() => setQuickType(t.vehicleType)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                        quickType === t.vehicleType
                          ? 'border-stone-800 bg-[#292524] text-white shadow-md'
                          : 'border-stone-200 bg-stone-50 hover:bg-white text-stone-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{t.label}</span>
                        </div>
                        <p className={`text-[10px] leading-tight ${quickType === t.vehicleType ? 'text-stone-300' : 'text-stone-500'}`}>
                          {t.description}
                        </p>
                      </div>
                      <div className="mt-3 text-right">
                        <span className={`text-base font-bold flex items-center justify-end ${quickType === t.vehicleType ? 'text-[#FFB7B2]' : 'text-stone-900'}`}>
                          <Rupee className="mr-0.5" />
                          {t.hourlyRate.toFixed(2)}
                        </span>
                        <span className={`text-[10px] ml-0.5 ${quickType === t.vehicleType ? 'text-stone-400' : 'text-stone-500'}`}>
                          /hr
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slot Allocation Preference */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Slot Allocation ({quickFloor})
                </label>
                <select
                  value={quickSlotId}
                  onChange={(e) => setQuickSlotId(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                >
                  <option value="">⚡ Auto-assign the best available slot on {quickFloor}</option>
                  {availableSlotsForQuick.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({s.type.toUpperCase()}) - {s.floor}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-500 mt-1">
                  Our system automatically prevents double-allocations and steers your car safely.
                </p>
              </div>

              {quickError && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{quickError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full sm:w-auto py-3.5 px-8 rounded-full bg-[#FFB7B2] text-stone-900 font-bold text-sm hover:brightness-95 transition-all shadow-[0_4px_16px_rgba(255,183,178,0.5)] flex items-center justify-center gap-2"
              >
                <Car className="w-4 h-4" />
                Park My Car & Watch Drive-In
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: ADVANCE BOOKING AND RESERVATION */}
      {activeTab === 'reserve' && (
        <div className="bg-white rounded-4xl p-6 sm:p-8 border border-stone-200/80 shadow-sm animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7">
              <span className="font-handwriting text-2xl text-stone-500 block mb-1">
                plan ahead stress-free
              </span>
              <h3 className="font-outfit text-3xl font-bold text-[#292524] tracking-tight">
                Advance Slot Reservation
              </h3>
              <p className="text-sm text-[#78716C] mt-1 mb-6">
                Reserve your favorite parking slot in advance across 3 floors. Our smart scheduler validates time windows and prevents any overlapping reservations.
              </p>

              <form onSubmit={handleReserveSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={resDate}
                      onChange={(e) => setResDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      required
                      value={resStartHour}
                      onChange={(e) => setResStartHour(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Duration</label>
                    <select
                      value={resDurationHours}
                      onChange={(e) => setResDurationHours(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                    >
                      <option value={1}>1 Hour</option>
                      <option value={2}>2 Hours</option>
                      <option value={3}>3 Hours</option>
                      <option value={4}>4 Hours</option>
                      <option value={6}>6 Hours</option>
                      <option value={8}>Full Day (8h)</option>
                    </select>
                  </div>
                </div>

                {/* Floor Picker for Reservation */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Choose Parking Floor
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Floor 1', 'Floor 2', 'Floor 3'] as const).map((fl) => (
                      <button
                        key={fl}
                        type="button"
                        onClick={() => {
                          setResFloor(fl);
                          setResSlotId('');
                        }}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                          resFloor === fl
                            ? 'border-stone-900 bg-[#292524] text-white shadow-xs'
                            : 'border-stone-200 bg-stone-50 hover:bg-white text-stone-700'
                        }`}
                      >
                        {fl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Vehicle Plate <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. MH-12-PQ-9012"
                      value={resPlate}
                      onChange={(e) => setResPlate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 font-mono text-xs uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Driver Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ananya Patel"
                      value={resDriver}
                      onChange={(e) => setResDriver(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Vehicle Type</label>
                    <select
                      value={resType}
                      onChange={(e) => setResType(e.target.value as VehicleType)}
                      className="w-full px-3 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                    >
                      <option value="car">Car (₹{DEFAULT_TARIFFS.car || 50}/hr)</option>
                      <option value="two-wheeler">2-Wheeler (₹{DEFAULT_TARIFFS['two-wheeler'] || 20}/hr)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Choose Slot on {resFloor}
                    </label>
                    <select
                      value={resSlotId}
                      onChange={(e) => setResSlotId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                    >
                      {availableSlotsForRes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label} ({s.type.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Real-time estimated fee box in Rupees (₹) */}
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-stone-800">Estimated Total Fee:</span>
                    <span className="text-stone-500 block text-[11px] flex items-center gap-0.5">
                      {resDurationHours} hrs @ <Rupee className="inline" />{DEFAULT_TARIFFS[resType]}/hr + 8% tax
                    </span>
                  </div>
                  <span className="text-lg font-bold text-stone-900 flex items-center">
                    <Rupee className="mr-0.5" />
                    {(DEFAULT_TARIFFS[resType] * resDurationHours * 1.08).toFixed(2)}
                  </span>
                </div>

                {resError && (
                  <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{resError}</span>
                  </div>
                )}

                {resSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{resSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 px-6 rounded-full bg-[#292524] text-white font-semibold text-sm hover:bg-stone-800 transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Confirm Advance Reservation
                </button>
              </form>
            </div>

            {/* Right column: Active Reservations List */}
            <div className="lg:col-span-5 bg-stone-50/70 p-5 rounded-3xl border border-stone-200/70">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-outfit font-bold text-stone-900 text-lg">
                  Scheduled Bookings
                </h4>
                <span className="text-xs bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full font-semibold">
                  {reservations.length} Bookings
                </span>
              </div>

              {reservations.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                  No upcoming reservations yet. Book your slot above!
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {reservations.map((res) => (
                    <div
                      key={res.id}
                      className="p-3 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900 font-mono">
                          {res.slotLabel} ({res.floor})
                        </span>
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
                      </div>

                      <div className="text-stone-600">
                        <span className="font-semibold text-stone-800">{res.driverName}</span> •{' '}
                        <span className="font-mono text-[11px]">{res.vehiclePlate}</span> ({res.vehicleType})
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-stone-500">
                        <span>{formatCalmDateTime(res.startTime)}</span>
                        <span className="flex items-center">Est: <Rupee className="ml-1 mr-0.5" />{res.estimatedFee.toFixed(2)}</span>
                      </div>

                      {res.status === 'confirmed' && (
                        <div className="pt-1 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => onCancelReservation(res.id)}
                            className="text-[11px] text-rose-600 hover:text-rose-800 font-medium hover:underline"
                          >
                            Cancel Booking
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MY ACTIVE TICKET */}
      {activeTab === 'active_ticket' && (
        <div className="bg-white rounded-4xl p-6 sm:p-8 border border-stone-200/80 shadow-sm animate-in fade-in duration-300">
          <div className="max-w-xl">
            <span className="font-handwriting text-2xl text-stone-500 block mb-1">
              live session tracking
            </span>
            <h3 className="font-outfit text-3xl font-bold text-[#292524] tracking-tight mb-4">
              Current Parking Ticket
            </h3>

            {activeOccupiedSlot && activeOccupiedSlot.currentVehicle ? (
              <div className="p-6 bg-[#FDFCF8] rounded-3xl border border-stone-200/90 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-dashed border-stone-200">
                  <div>
                    <span className="text-xs text-stone-500 uppercase font-semibold">Allocated Slot</span>
                    <h4 className="font-outfit text-2xl font-bold text-stone-900">
                      {activeOccupiedSlot.label} • {activeOccupiedSlot.floor}
                    </h4>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#FFB7B2] text-rose-950 text-xs font-bold uppercase tracking-wider">
                    Vehicle Parked
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs text-stone-600">
                  <div>
                    <span className="text-stone-400 block">License Plate</span>
                    <span className="font-mono font-bold text-stone-900 text-sm">
                      {activeOccupiedSlot.currentVehicle.plate}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block">Vehicle Class</span>
                    <span className="capitalize font-semibold text-stone-800 text-sm">
                      {activeOccupiedSlot.currentVehicle.vehicleType}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block">Entry Time</span>
                    <span className="font-medium text-stone-800">
                      {formatCalmDateTime(activeOccupiedSlot.currentVehicle.entryTime)}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block">Tariff Rate</span>
                    <span className="font-semibold text-stone-800 flex items-center">
                      <Rupee className="mr-0.5" />{activeOccupiedSlot.currentVehicle.hourlyTariff.toFixed(2)}/hr
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-700 animate-spin" style={{ animationDuration: '6s' }} />
                    <div>
                      <span className="text-xs font-semibold text-emerald-900 block">Active Duration</span>
                      <span className="text-xs text-emerald-700">Ticking in real time</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-lg text-emerald-900">
                    {calculateParkingFee(activeOccupiedSlot.currentVehicle.entryTime, Date.now(), activeOccupiedSlot.currentVehicle.hourlyTariff).durationFormatted}
                  </span>
                </div>

                <button
                  onClick={() => onExitVehicle(activeOccupiedSlot.id, 'UPI / QR Code')}
                  className="w-full py-3.5 px-6 rounded-full bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Exit Slot, Pay (₹) & Watch Drive-Away
                </button>
              </div>
            ) : (
              <div className="text-center py-12 bg-stone-50 rounded-3xl border border-stone-200/70 text-stone-400">
                <Car className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                <p className="text-sm font-medium text-stone-600">You don't have a vehicle parked right now.</p>
                <p className="text-xs text-stone-400 mt-1 mb-4">
                  Select a slot on the map or use the Park Now tab to allocate a space!
                </p>
                <button
                  onClick={() => setActiveTab('park_now')}
                  className="px-5 py-2.5 rounded-full bg-[#FFB7B2] text-stone-900 text-xs font-bold hover:brightness-95 transition-all shadow-xs"
                >
                  Park a Vehicle Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: MY RECEIPTS & PAYMENT HISTORY */}
      {activeTab === 'receipts' && (
        <div className="bg-white rounded-4xl p-6 sm:p-8 border border-stone-200/80 shadow-sm animate-in fade-in duration-300">
          <div className="max-w-3xl">
            <span className="font-handwriting text-2xl text-stone-500 block mb-1">
              transparent records
            </span>
            <h3 className="font-outfit text-3xl font-bold text-[#292524] tracking-tight mb-2">
              Parking Invoices & Receipts
            </h3>
            <p className="text-sm text-[#78716C] mb-6">
              View official parking receipts in Rupees (₹) for completed sessions, complete with timestamps, calculated tariffs, and payment status.
            </p>

            {receipts.length === 0 ? (
              <div className="text-center py-12 bg-stone-50 rounded-3xl border border-stone-200/70 text-stone-400">
                <FileText className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                <p className="text-sm font-medium text-stone-600">No completed sessions yet.</p>
                <p className="text-xs text-stone-400 mt-1">
                  When you check out and exit a slot, your verified receipt will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {receipts.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 bg-stone-50/70 hover:bg-stone-50 rounded-3xl border border-stone-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 font-mono text-sm">
                          Receipt #{rec.receiptNumber}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {rec.paymentStatus}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">
                        Slot: <span className="font-semibold">{rec.slotLabel} ({rec.floor})</span> • Vehicle:{' '}
                        <span className="font-mono">{rec.vehiclePlate}</span> ({rec.vehicleType})
                      </p>
                      <p className="text-[11px] text-stone-400">
                        {formatCalmDateTime(rec.entryTime)} → {formatCalmDateTime(rec.exitTime)} ({rec.durationFormatted})
                      </p>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="text-xs text-stone-400 block">Total Paid</span>
                        <span className="text-lg font-bold text-stone-900 flex items-center justify-end">
                          <Rupee className="mr-0.5" />
                          {rec.totalAmount.toFixed(2)}
                        </span>
                      </div>
                      <button
                        onClick={() => onViewReceipt(rec)}
                        className="py-2 px-4 rounded-full bg-white border border-stone-300 text-stone-800 text-xs font-semibold hover:bg-stone-100 transition-colors shadow-2xs"
                      >
                        View Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
