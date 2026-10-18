/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import type { ParkingSlot, VehicleInfo } from '../types/parking.js';
import { CarSvg } from './CarSvg.js';
import { Rupee } from './Rupee.js';
import { Clock, Wrench, ArrowRight, Layers } from 'lucide-react';

export interface CarAnimationState {
  id: string;
  slotId: string;
  vehicle: VehicleInfo;
  phase: 'driving_in_lane' | 'turning_into_slot' | 'parked' | 'reversing_out' | 'driving_to_exit' | 'completed';
  xPercent: number; // 0 to 100%
  yPercent: number; // 0 to 100%
  rotation: number; // degrees
  targetRow: number;
  targetCol: number;
  floor: string;
}

interface AnimatedParkingLotProps {
  slots: ParkingSlot[];
  onSelectSlot: (slot: ParkingSlot) => void;
  selectedSlotId?: string | null;
  activeAnimation: CarAnimationState | null;
  currentFloor: 'Floor 1' | 'Floor 2' | 'Floor 3';
  onChangeFloor: (floor: 'Floor 1' | 'Floor 2' | 'Floor 3') => void;
  isAdmin?: boolean;
}

export const AnimatedParkingLot: React.FC<AnimatedParkingLotProps> = ({
  slots,
  onSelectSlot,
  selectedSlotId,
  activeAnimation,
  currentFloor,
  onChangeFloor,
  isAdmin = false,
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  // Filter slots by currently selected floor
  const floorSlots = slots.filter((s) => s.floor === currentFloor);
  const upperRowSlots = floorSlots.filter((s) => s.row === 0);
  const lowerRowSlots = floorSlots.filter((s) => s.row === 1);

  // Time tracker for live parking duration tickers
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const getSlotTypeBadge = (type: ParkingSlot['type']) => {
    switch (type) {
      case 'two-wheeler':
        return (
          <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            2-Wheeler
          </span>
        );
      case 'car':
      default:
        return (
          <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
            Car
          </span>
        );
    }
  };

  const getStatusBadge = (status: ParkingSlot['status']) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-800 border border-emerald-200/90 shadow-2xs">
            <span className="relative flex h-2 w-2 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            Available
          </span>
        );
      case 'occupied':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 text-[11px] font-semibold text-rose-800 border border-rose-200/90 shadow-2xs">
            <span className="relative flex h-2 w-2 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
            </span>
            Occupied
          </span>
        );
      case 'reserved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-50 text-[11px] font-semibold text-purple-800 border border-purple-200/90 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
            Reserved
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-stone-100 text-[11px] font-medium text-stone-600 border border-stone-200">
            <Wrench className="w-3 h-3" />
            Closed
          </span>
        );
    }
  };

  const renderSlotCard = (slot: ParkingSlot) => {
    const isSelected = selectedSlotId === slot.id;
    const isBeingAnimated =
      activeAnimation &&
      activeAnimation.slotId === slot.id &&
      activeAnimation.floor === currentFloor &&
      activeAnimation.phase !== 'completed';

    // Show vehicle inside slot if occupied AND not currently driving away
    const showVehicleInside =
      slot.status === 'occupied' &&
      slot.currentVehicle &&
      (!activeAnimation || activeAnimation.slotId !== slot.id || activeAnimation.phase === 'parked');

    const durationMins = slot.currentVehicle
      ? Math.max(1, Math.round((currentTime - slot.currentVehicle.entryTime) / (1000 * 60)))
      : 0;
    const hours = Math.floor(durationMins / 60);
    const mins = durationMins % 60;

    // Filter check
    const isDimmed =
      filterType !== 'all' &&
      (filterType === 'available'
        ? slot.status !== 'available'
        : filterType === 'occupied'
        ? slot.status !== 'occupied'
        : slot.type !== filterType);

    return (
      <div
        key={slot.id}
        onClick={() => onSelectSlot(slot)}
        tabIndex={0}
        role="button"
        aria-label={`Parking slot ${slot.label}, ${slot.status}, ${slot.type}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectSlot(slot);
          }
        }}
        className={`group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-3xl transition-all duration-300 border cursor-pointer select-none overflow-hidden
          ${isDimmed ? 'opacity-35 scale-95' : 'opacity-100'}
          ${
            isSelected
              ? 'ring-2 ring-[#FFB7B2] ring-offset-2 border-stone-400 bg-white shadow-lg'
              : 'border-stone-200/80 bg-white/90 hover:bg-white hover:border-stone-300 shadow-sm hover:shadow-md'
          }
          min-h-[175px] sm:min-h-[195px]`}
      >
        {/* Slot Header */}
        <div className="flex items-start justify-between gap-1">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-outfit font-bold text-stone-800 text-lg sm:text-xl tracking-tight">
                {slot.label}
              </span>
              {getSlotTypeBadge(slot.type)}
            </div>
            <p className="text-[11px] text-stone-500 font-medium">{slot.floor}</p>
          </div>
          <div>{getStatusBadge(slot.status)}</div>
        </div>

        {/* Slot Ground Markings & Vehicle Display */}
        <div className="relative my-2 h-24 sm:h-26 w-full rounded-2xl bg-stone-50/80 border border-dashed border-stone-300 flex items-center justify-center overflow-hidden">
          {/* Subtle ground striping */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px)] bg-[size:16px_16px] opacity-40"></div>

          {/* Slot curb stop bar */}
          <div className="absolute top-1 left-3 right-3 h-1.5 bg-stone-200 rounded-full" />

          {/* In-Slot Sensor Blinker (Contained safely inside the slot card) */}
          <div className="absolute top-1.5 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 border border-stone-200 shadow-2xs backdrop-blur-xs pointer-events-none">
            {slot.status === 'available' ? (
              <>
                <span className="relative flex h-2 w-2 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[9px] font-mono font-bold tracking-tight text-emerald-800 uppercase">Available</span>
              </>
            ) : slot.status === 'occupied' ? (
              <>
                <span className="relative flex h-2 w-2 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                </span>
                <span className="text-[9px] font-mono font-bold tracking-tight text-rose-800 uppercase">Occupied</span>
              </>
            ) : slot.status === 'reserved' ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                <span className="text-[9px] font-mono font-bold tracking-tight text-purple-800 uppercase">Reserved</span>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-stone-400"></span>
                <span className="text-[9px] font-mono font-bold tracking-tight text-stone-500 uppercase">Closed</span>
              </>
            )}
          </div>

          {/* Parked Vehicle */}
          {showVehicleInside && slot.currentVehicle && (
            <div className="relative z-10 animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center">
              <CarSvg
                type={slot.currentVehicle.vehicleType}
                color={slot.currentVehicle.color}
                plate={slot.currentVehicle.plate}
                className="transform transition-transform group-hover:scale-105"
              />
            </div>
          )}

          {/* Empty slot guide indicator */}
          {!showVehicleInside && !isBeingAnimated && slot.status === 'available' && (
            <div className="z-10 flex flex-col items-center justify-center text-center p-2">
              <span className="font-handwriting text-stone-400 text-xl group-hover:text-stone-600 transition-colors">
                park here
              </span>
              <span className="text-[11px] text-stone-400 font-medium">Ready</span>
            </div>
          )}

          {/* Reserved slot badge */}
          {slot.status === 'reserved' && (
            <div className="z-10 flex flex-col items-center text-center p-2 bg-purple-50/90 rounded-xl border border-purple-200/80">
              <Clock className="w-4 h-4 text-purple-600 mb-0.5" />
              <span className="text-[11px] font-semibold text-purple-900">Reserved</span>
              <span className="text-[10px] text-purple-700">Upcoming session</span>
            </div>
          )}

          {/* Maintenance placeholder */}
          {slot.status === 'maintenance' && (
            <div className="z-10 flex flex-col items-center text-center p-2 text-stone-400">
              <Wrench className="w-4 h-4 mb-1" />
              <span className="text-[11px] font-medium">Slot Closed</span>
            </div>
          )}
        </div>

        {/* Slot Footer Action / Details in Rupees (₹) */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-100">
          {slot.status === 'occupied' && slot.currentVehicle ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-stone-500 flex items-center gap-1 font-mono text-[11px]">
                <Clock className="w-3 h-3 text-stone-400" />
                {hours > 0 ? `${hours}h ` : ''}{mins}m
              </span>
              <span className="font-semibold text-stone-800 flex items-center">
                <Rupee className="mr-0.5" />
                {(slot.currentVehicle.hourlyTariff * Math.max(1, Math.ceil(durationMins / 60))).toFixed(2)}
              </span>
            </div>
          ) : slot.status === 'available' ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-stone-500 text-[11px]">Tap to inspect</span>
              <span className="text-[11px] font-medium text-emerald-700 group-hover:underline">
                Select →
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-stone-400 w-full text-center">
              {slot.status === 'reserved' ? 'Tap to view booking' : 'Unavailable'}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-[#FDFCF8] rounded-4xl p-4 sm:p-6 lg:p-8 border border-stone-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
      {/* 3 FLOORS SELECTOR TABS */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-5 border-b border-stone-200/60">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-stone-700" />
          <span className="font-outfit font-bold text-stone-900 text-base sm:text-lg">Select Floor:</span>
        </div>

        <div className="flex items-center gap-2 p-1 bg-stone-100/90 rounded-full border border-stone-200">
          {(['Floor 1', 'Floor 2', 'Floor 3'] as const).map((floorName) => {
            const countOpen = slots.filter((s) => s.floor === floorName && s.status === 'available').length;
            const isCurrent = currentFloor === floorName;
            return (
              <button
                key={floorName}
                onClick={() => onChangeFloor(floorName)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-outfit font-semibold transition-all ${
                  isCurrent
                    ? 'bg-[#292524] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/80'
                }`}
              >
                <span>{floorName}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isCurrent ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {countOpen} Open
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-5 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-outfit text-2xl sm:text-3xl font-bold text-[#292524] tracking-tight">
              Live Parking Floor
            </h3>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#E8EFE8] text-stone-800 border border-stone-200">
              {currentFloor}
            </span>
          </div>
          <p className="text-sm text-[#78716C] mt-0.5">
            Real-time slot availability, animated vehicle navigation, and instant allocation.
          </p>
        </div>

        {/* Filter Pills - Only Car and Two-Wheeler */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-100/80 rounded-full border border-stone-200/80 text-xs">
          {[
            { id: 'all', label: 'All Slots' },
            { id: 'available', label: 'Available (Open)' },
            { id: 'occupied', label: 'Occupied' },
            { id: 'car', label: 'Car Slots' },
            { id: 'two-wheeler', label: '2-Wheeler Slots' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setFilterType(pill.id)}
              className={`px-3 py-1.5 rounded-full font-medium transition-all ${
                filterType === pill.id
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* The Animated Parking Layout Floor */}
      <div className="relative mt-6 p-4 sm:p-6 bg-[#F8F7F2] rounded-3xl border border-stone-200 overflow-hidden">
        {/* Upper Row of Slots */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-4">
          {upperRowSlots.map(renderSlotCard)}
        </div>

        {/* Driveway Lane / Central Aisle */}
        <div className="relative my-4 py-4 sm:py-5 px-6 bg-stone-200/80 rounded-2xl border border-stone-300 flex items-center justify-between select-none overflow-hidden">
          {/* Road Asphalt Texture */}
          <div className="absolute inset-0 bg-[#2b2725] opacity-90"></div>

          {/* Driving Lane Center Dashed Line */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0 border-b-2 border-dashed border-amber-300/80 z-0"></div>

          {/* Entrance Lane Indicator */}
          <div className="relative z-10 flex items-center gap-2 bg-emerald-600/90 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-md backdrop-blur-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse"></span>
            Entrance Gate • {currentFloor}
            <ArrowRight className="w-3.5 h-3.5" />
          </div>

          {/* Directional Driveway Labels */}
          <div className="relative z-10 hidden md:flex items-center gap-6 text-stone-300 text-xs tracking-widest font-mono uppercase opacity-75">
            <span>◄ Slow Driveway • Max 10 km/h ►</span>
          </div>

          {/* Exit Lane Indicator */}
          <div className="relative z-10 flex items-center gap-2 bg-rose-600/90 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-md backdrop-blur-xs">
            Exit & Payment Gate
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Lower Row of Slots */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mt-4">
          {lowerRowSlots.map(renderSlotCard)}
        </div>

        {/* ACTIVE CAR ANIMATION OVERLAY */}
        {activeAnimation && activeAnimation.floor === currentFloor && (
          <div
            className="absolute pointer-events-none z-30 transition-all ease-out"
            style={{
              left: `${activeAnimation.xPercent}%`,
              top: `${activeAnimation.yPercent}%`,
              transform: `translate(-50%, -50%) rotate(${activeAnimation.rotation}deg)`,
              transitionDuration:
                activeAnimation.phase === 'turning_into_slot' || activeAnimation.phase === 'reversing_out'
                  ? '700ms'
                  : '1100ms',
            }}
          >
            <div className="relative flex flex-col items-center">
              <CarSvg
                type={activeAnimation.vehicle.vehicleType}
                color={activeAnimation.vehicle.color}
                plate={activeAnimation.vehicle.plate}
                isHeadlightsOn={true}
                isBraking={activeAnimation.phase === 'parked' || activeAnimation.phase === 'reversing_out'}
              />

              {/* Status speech bubble / pill above moving car */}
              <div
                className="absolute -top-7 whitespace-nowrap bg-stone-900/90 text-white text-[10px] font-medium px-2 py-0.5 rounded-full shadow-lg border border-stone-700/60 transition-opacity"
                style={{
                  transform: `rotate(${-activeAnimation.rotation}deg)`,
                }}
              >
                {activeAnimation.phase === 'driving_in_lane' && `Navigating to ${activeAnimation.slotId}...`}
                {activeAnimation.phase === 'turning_into_slot' && `Parking into ${activeAnimation.slotId}...`}
                {activeAnimation.phase === 'parked' && `Parked safely!`}
                {activeAnimation.phase === 'reversing_out' && `Reversing out of ${activeAnimation.slotId}...`}
                {activeAnimation.phase === 'driving_to_exit' && `Proceeding to Exit Gate...`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lot Stats & Legend Footer */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-[#78716C] pt-4 border-t border-stone-200/60">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-emerald-100 border border-emerald-300"></span>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-[#FFB7B2] border border-rose-300"></span>
            <span>Occupied (Car Parked)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-purple-100 border border-purple-300"></span>
            <span>Reserved</span>
          </div>
        </div>

        <div className="text-right">
          <span className="font-handwriting text-lg text-stone-500">
            cars automatically navigate to allocated slots
          </span>
        </div>
      </div>
    </div>
  );
};
