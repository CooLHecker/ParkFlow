/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { ParkingSlot, VehicleType, Reservation } from '../types/parking.js';
import { DEFAULT_TARIFFS, calculateParkingFee, formatCalmDateTime } from '../utils/parkingLogic.js';
import { X, Car, Clock, CreditCard, Wrench } from 'lucide-react';
import { Rupee } from './Rupee.js';

interface SlotActionModalProps {
  slot: ParkingSlot | null;
  onClose: () => void;
  onParkVehicle: (slotId: string, vehiclePlate: string, vehicleType: VehicleType, driverName?: string) => void;
  onExitVehicle: (slotId: string, paymentMethod: string) => void;
  onToggleMaintenance: (slotId: string) => void;
  reservations: Reservation[];
  onCancelReservation: (reservationId: string) => void;
  onCheckInReservation: (reservation: Reservation) => void;
  onSwitchToReservationTab?: (slotId: string) => void;
  isAdmin?: boolean;
}

export const SlotActionModal: React.FC<SlotActionModalProps> = ({
  slot,
  onClose,
  onParkVehicle,
  onExitVehicle,
  onToggleMaintenance,
  reservations,
  onCancelReservation,
  onCheckInReservation,
  onSwitchToReservationTab,
  isAdmin = false,
}) => {
  if (!slot) return null;

  // Form states for parking a vehicle
  const [plate, setPlate] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<VehicleType>(
    slot.type === 'two-wheeler' ? 'two-wheeler' : 'car'
  );
  const [driverName, setDriverName] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI / QR Code');
  const [formError, setFormError] = useState<string>('');

  // Associated reservation if slot is reserved
  const slotReservation = reservations.find(
    (r) => r.slotId === slot.id && (r.status === 'confirmed' || r.status === 'pending')
  );

  const handleParkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim()) {
      setFormError('Please enter a vehicle license plate number');
      return;
    }
    setFormError('');
    onParkVehicle(slot.id, plate.trim().toUpperCase(), vehicleType, driverName.trim());
    onClose();
  };

  const handleExitSubmit = () => {
    onExitVehicle(slot.id, paymentMethod);
    onClose();
  };

  // Calculate live fee if occupied in Rupees (₹)
  const now = Date.now();
  const currentFee =
    slot.status === 'occupied' && slot.currentVehicle
      ? calculateParkingFee(slot.currentVehicle.entryTime, now, slot.currentVehicle.hourlyTariff)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-action-title"
        className="relative w-full max-w-lg bg-[#FDFCF8] rounded-4xl p-6 sm:p-8 shadow-2xl border border-stone-200/90 max-h-[90vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close slot dialog"
          className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
          <div className="w-12 h-12 rounded-2xl bg-[#E8EFE8] flex items-center justify-center text-stone-800 font-outfit font-bold text-xl">
            {slot.label}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 id="slot-action-title" className="font-outfit text-2xl font-bold text-[#292524] tracking-tight">
                {slot.label} Details
              </h3>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                  slot.status === 'available'
                    ? 'bg-emerald-100 text-emerald-800'
                    : slot.status === 'occupied'
                    ? 'bg-[#FFB7B2] text-rose-950'
                    : slot.status === 'reserved'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {slot.status}
              </span>
            </div>
            <p className="text-xs text-[#78716C] mt-0.5 flex items-center">
              {slot.floor} • Type: {slot.type.toUpperCase()} • Tariff: <Rupee className="mx-1" />{DEFAULT_TARIFFS[vehicleType]}/hr
            </p>
          </div>
        </div>

        {/* STATE 1: SLOT IS AVAILABLE -> PARK NOW OR RESERVE */}
        {slot.status === 'available' && (
          <div className="mt-5 space-y-4">
            <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200/60 flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></div>
              <p className="text-xs text-emerald-800 font-medium">
                This slot is ready for immediate parking or advance booking on {slot.floor}.
              </p>
            </div>

            <form onSubmit={handleParkSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  License Plate Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH-02-CD-4567"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-stone-300 font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                />
                {formError && <p className="text-xs text-rose-600 mt-1">{formError}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Vehicle Type & Tariff Rate (₹/hr)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'car', label: `Car (₹${DEFAULT_TARIFFS.car || 50}/h)` },
                    { id: 'two-wheeler', label: `2-Wheeler (₹${DEFAULT_TARIFFS['two-wheeler'] || 20}/h)` },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setVehicleType(item.id as VehicleType)}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium text-left transition-all ${
                        vehicleType === item.id
                          ? 'border-stone-800 bg-[#292524] text-white shadow-xs'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Driver Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Sharma"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB7B2]"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="submit"
                  className="w-full sm:flex-1 py-3 px-5 rounded-full bg-[#FFB7B2] text-stone-900 font-semibold text-sm hover:brightness-95 transition-all shadow-[0_4px_12px_rgba(255,183,178,0.4)] flex items-center justify-center gap-2"
                >
                  <Car className="w-4 h-4 text-stone-800" />
                  Park Vehicle Now
                </button>

                {onSwitchToReservationTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSwitchToReservationTab(slot.id);
                    }}
                    className="w-full sm:w-auto py-3 px-5 rounded-full border border-stone-300 bg-white text-stone-800 font-medium text-sm hover:bg-stone-50 transition-colors"
                  >
                    Reserve in Advance
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* STATE 2: SLOT IS OCCUPIED -> VIEW SESSION & EXIT */}
        {slot.status === 'occupied' && slot.currentVehicle && currentFee && (
          <div className="mt-5 space-y-4">
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-stone-500">License Plate:</span>
                <span className="font-mono font-bold text-stone-900 text-base">
                  {slot.currentVehicle.plate}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500">Floor & Slot:</span>
                <span className="font-medium text-stone-800">
                  {slot.floor} • {slot.label}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500">Vehicle Type:</span>
                <span className="capitalize font-medium text-stone-800">
                  {slot.currentVehicle.vehicleType} (₹{slot.currentVehicle.hourlyTariff}/hr)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500">Entry Time:</span>
                <span className="font-medium text-stone-800">
                  {formatCalmDateTime(slot.currentVehicle.entryTime)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500">Current Duration:</span>
                <span className="font-bold text-stone-900 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-stone-500" />
                  {currentFee.durationFormatted}
                </span>
              </div>

              <div className="pt-2 border-t border-stone-200 flex justify-between items-center">
                <div>
                  <span className="text-xs text-stone-500 block">Accumulated Parking Fee</span>
                  <span className="text-[11px] text-stone-400">Includes 8% service tax</span>
                </div>
                <span className="text-2xl font-bold text-[#292524] flex items-center">
                  <Rupee className="mr-0.5" />
                  {currentFee.total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Select Checkout Payment Method:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['UPI / QR Code', 'Cash', 'Credit / Debit Card'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium text-center transition-all ${
                      paymentMethod === method
                        ? 'border-stone-900 bg-[#292524] text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleExitSubmit}
                className="w-full py-3.5 px-5 rounded-full bg-rose-600 text-white font-semibold text-sm hover:bg-rose-700 transition-all shadow-md flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Process Exit & Pay (<Rupee className="inline" />{currentFee.total.toFixed(2)})
              </button>
              <p className="text-[11px] text-stone-400 text-center mt-2">
                This will calculate total fees in Rupees, generate a receipt, and animate the vehicle exiting the slot.
              </p>
            </div>
          </div>
        )}

        {/* STATE 3: SLOT IS RESERVED */}
        {slot.status === 'reserved' && (
          <div className="mt-5 space-y-4">
            {slotReservation ? (
              <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-200/80 space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-purple-900 font-medium">Reserved For:</span>
                  <span className="font-bold text-purple-950">{slotReservation.driverName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-800 text-xs">Vehicle Plate:</span>
                  <span className="font-mono font-bold text-purple-950 uppercase">
                    {slotReservation.vehiclePlate}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-purple-800">Time Window:</span>
                  <span className="font-medium text-purple-950">
                    {formatCalmDateTime(slotReservation.startTime)} → {formatCalmDateTime(slotReservation.endTime)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-purple-800">Status:</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 font-semibold uppercase text-[10px]">
                    {slotReservation.status}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-500">Reserved for an upcoming booking session.</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              {slotReservation && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onCheckInReservation(slotReservation);
                      onClose();
                    }}
                    className="flex-1 py-3 px-4 rounded-full bg-[#292524] text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-xs"
                  >
                    Check In Vehicle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onCancelReservation(slotReservation.id);
                      onClose();
                    }}
                    className="flex-1 py-3 px-4 rounded-full border border-rose-300 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50 transition-colors"
                  >
                    Cancel Booking
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* STATE 4: MAINTENANCE / ADMIN TOGGLE */}
        {isAdmin && (
          <div className="mt-6 pt-4 border-t border-stone-200 flex items-center justify-between">
            <span className="text-xs text-stone-500 font-medium">Slot Maintenance:</span>
            <button
              type="button"
              onClick={() => {
                onToggleMaintenance(slot.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-stone-300 text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <Wrench className="w-3.5 h-3.5" />
              {slot.status === 'maintenance' ? 'Re-open Slot' : 'Set to Maintenance'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
