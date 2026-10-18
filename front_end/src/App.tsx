/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import type {
  ParkingSlot,
  VehicleInfo,
  VehicleType,
  Reservation,
  Receipt,
} from './types/parking.js';
import { DEFAULT_TARIFFS } from './utils/parkingLogic.js';
import { api, ApiError } from './api.js';
import { GrainOverlay } from './components/GrainOverlay.js';
import { Navbar } from './components/Navbar.js';
import { AnimatedParkingLot, CarAnimationState } from './components/AnimatedParkingLot.js';
import { SlotActionModal } from './components/SlotActionModal.js';
import { UserDashboard } from './components/UserDashboard.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { ReceiptModal } from './components/ReceiptModal.js';
import { ScenarioScroll } from './components/ScenarioScroll.js';
import { Car, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'user' | 'admin'>('user');
  const [currentFloor, setCurrentFloor] = useState<'Floor 1' | 'Floor 2' | 'Floor 3'>('Floor 1');
  // All data comes from the backend (Aiven MySQL) – see src/api.ts
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [tariffs, setTariffs] = useState<Record<VehicleType, number>>(DEFAULT_TARIFFS);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string>('');

  // Active selected slot for modal
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);

  // Active receipt for modal
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);

  // Notification toast
  const [notification, setNotification] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

  const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');

  // Pull the latest slots / reservations / receipts / tariffs from the database
  const refresh = async () => {
    try {
      const data = await api.getState();
      setSlots(data.slots);
      setReservations(data.reservations);
      setReceipts(data.receipts);
      setTariffs((prev) => ({ ...prev, ...data.tariffs }));
      setLoadState('ready');
    } catch (e) {
      // keep showing the last known data if we were already loaded
      setLoadState((prev) => {
        if (prev === 'ready') {
          showToast(errMsg(e));
          return prev;
        }
        setLoadError(errMsg(e));
        return 'error';
      });
    }
  };

  useEffect(() => {
    void refresh();
    // keep multiple browser tabs / the admin & user views in sync
    const timer = setInterval(() => {
      if (!animationBusyRef.current) void refresh();
    }, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animated Car State
  const [activeAnimation, setActiveAnimation] = useState<CarAnimationState | null>(null);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationBusyRef = useRef(false);
  useEffect(() => {
    animationBusyRef.current = activeAnimation !== null;
  }, [activeAnimation]);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };
  }, []);

  // Calculate coordinates on the lot for a slot (col: 0..4, row: 0 or 1)
  const getSlotCoordinates = (col: number, row: number) => {
    const colPercentages = [10, 30, 50, 70, 90];
    const x = colPercentages[col] || 50;
    const y = row === 0 ? 20 : 80;
    return { x, y };
  };

  // ANIMATION: VEHICLE ENTRY
  const triggerCarDriveInAnimation = (
    slotId: string,
    vehicle: VehicleInfo,
    onComplete?: () => void
  ) => {
    const targetSlot = slots.find((s) => s.id === slotId);
    if (!targetSlot) return;

    // Automatically switch view to the floor where the car is parking
    setCurrentFloor(targetSlot.floor);

    const { x: targetX, y: targetY } = getSlotCoordinates(targetSlot.col, targetSlot.row);
    const isUpperRow = targetSlot.row === 0;

    // Phase 1: Car starts at entrance gate (left aisle), driving horizontally along lane
    setActiveAnimation({
      id: `anim-${Date.now()}`,
      slotId,
      vehicle,
      phase: 'driving_in_lane',
      xPercent: 5,
      yPercent: 50,
      rotation: 90,
      targetRow: targetSlot.row,
      targetCol: targetSlot.col,
      floor: targetSlot.floor,
    });

    // Step 1b: Drive smoothly along driveway to slot column
    animationTimerRef.current = setTimeout(() => {
      setActiveAnimation((prev) =>
        prev
          ? {
              ...prev,
              xPercent: targetX,
              yPercent: 50,
            }
          : null
      );

      // Step 2: Turn towards slot and drive into it
      animationTimerRef.current = setTimeout(() => {
        setActiveAnimation((prev) =>
          prev
            ? {
                ...prev,
                phase: 'turning_into_slot',
                rotation: isUpperRow ? 0 : 180,
                yPercent: targetY,
              }
            : null
        );

        // Step 3: Parked smoothly inside slot
        animationTimerRef.current = setTimeout(() => {
          setActiveAnimation((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'parked',
                }
              : null
          );

          // Commit slot to occupied
          setSlots((prevSlots) =>
            prevSlots.map((s) =>
              s.id === slotId ? { ...s, status: 'occupied', currentVehicle: vehicle } : s
            )
          );

          showToast(`Vehicle ${vehicle.plate} parked safely in ${targetSlot.label} (${targetSlot.floor}).`);
          void refresh();

          // Clear animation state
          animationTimerRef.current = setTimeout(() => {
            setActiveAnimation(null);
            if (onComplete) onComplete();
          }, 600);
        }, 900);
      }, 900);
    }, 50);
  };

  // ANIMATION: VEHICLE EXIT (the receipt has already been issued + saved by the backend)
  const triggerCarDriveOutAnimation = (
    slotId: string,
    newReceipt: Receipt,
    onComplete?: (receipt: Receipt) => void
  ) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot || !slot.currentVehicle) return;

    setCurrentFloor(slot.floor);

    const vehicle = slot.currentVehicle;
    const { x: slotX, y: slotY } = getSlotCoordinates(slot.col, slot.row);

    // Phase 1: Vehicle in slot prepares to reverse out
    setActiveAnimation({
      id: `anim-exit-${Date.now()}`,
      slotId,
      vehicle,
      phase: 'reversing_out',
      xPercent: slotX,
      yPercent: slotY,
      rotation: slot.row === 0 ? 0 : 180,
      targetRow: slot.row,
      targetCol: slot.col,
      floor: slot.floor,
    });

    // Step 2: Reverse into center lane (y = 50%)
    animationTimerRef.current = setTimeout(() => {
      setActiveAnimation((prev) =>
        prev
          ? {
              ...prev,
              yPercent: 50,
            }
          : null
      );

      // Step 3: Turn right towards Exit Gate and drive off
      animationTimerRef.current = setTimeout(() => {
        setActiveAnimation((prev) =>
          prev
            ? {
                ...prev,
                phase: 'driving_to_exit',
                rotation: 90,
                xPercent: 105,
              }
            : null
        );

        // Step 4: Finalize slot availability & record receipt
        animationTimerRef.current = setTimeout(() => {
          setSlots((prevSlots) =>
            prevSlots.map((s) =>
              s.id === slotId ? { ...s, status: 'available', currentVehicle: undefined } : s
            )
          );

          setReceipts((prev) => [newReceipt, ...prev]);
          void refresh();
          setActiveAnimation(null);
          setActiveReceipt(newReceipt);
          showToast(`Vehicle ${vehicle.plate} checked out! Receipt #${newReceipt.receiptNumber} generated.`);
          if (onComplete) onComplete(newReceipt);
        }, 1100);
      }, 800);
    }, 50);
  };

  // HANDLER: PARK A VEHICLE (validated + saved by the backend, then animated)
  const handleParkVehicle = async (
    slotId: string,
    plate: string,
    vehicleType: VehicleType,
    _driverName?: string
  ) => {
    try {
      const saved = await api.parkVehicle(slotId, plate, vehicleType);
      if (saved.currentVehicle) triggerCarDriveInAnimation(slotId, saved.currentVehicle);
      else await refresh();
    } catch (e) {
      showToast(`Error: ${errMsg(e)}`);
      void refresh();
    }
  };

  // HANDLER: PROCESS VEHICLE EXIT (backend computes the fee and stores the payment)
  const handleExitVehicle = async (slotId: string, paymentMethod: string) => {
    try {
      const receipt = await api.exitVehicle(slotId, paymentMethod);
      triggerCarDriveOutAnimation(slotId, receipt);
    } catch (e) {
      showToast(`Error: ${errMsg(e)}`);
      void refresh();
    }
  };

  // HANDLER: CREATE ADVANCE RESERVATION (overlap check happens in the database transaction)
  const handleCreateReservation = async (
    slotId: string,
    plate: string,
    type: VehicleType,
    driverName: string,
    contact: string,
    start: number,
    end: number,
    _estimatedFee: number // ignored: the backend recomputes the fee from the stored tariff
  ) => {
    try {
      const created = await api.createReservation({
        slotId,
        plate,
        vehicleType: type,
        driverName,
        contactNumber: contact,
        startTime: start,
        endTime: end,
      });
      await refresh();
      showToast(`Reservation confirmed for ${created.slotLabel} (${created.floor})!`);
    } catch (e) {
      showToast(errMsg(e));
      void refresh();
    }
  };

  // HANDLER: CANCEL RESERVATION
  const handleCancelReservation = async (reservationId: string) => {
    try {
      const cancelled = await api.cancelReservation(reservationId);
      await refresh();
      showToast(`Reservation for ${cancelled.slotLabel} has been cancelled.`);
    } catch (e) {
      showToast(errMsg(e));
      void refresh();
    }
  };

  // HANDLER: CHECK IN RESERVED VEHICLE
  const handleCheckInReservation = async (reservation: Reservation) => {
    try {
      const { slot, reservation: done } = await api.checkInReservation(reservation.id);
      setReservations((prev) => prev.map((r) => (r.id === done.id ? done : r)));
      if (slot.currentVehicle) triggerCarDriveInAnimation(slot.id, slot.currentVehicle);
      else await refresh();
    } catch (e) {
      showToast(`Error: ${errMsg(e)}`);
      void refresh();
    }
  };

  // HANDLER: TOGGLE MAINTENANCE
  const handleToggleSlotMaintenance = async (slotId: string) => {
    try {
      await api.toggleMaintenance(slotId);
      await refresh();
      showToast(`Slot status updated.`);
    } catch (e) {
      showToast(errMsg(e));
      void refresh();
    }
  };

  // HANDLER: SAVE TARIFFS
  const handleUpdateTariffs = async (newTariffs: Record<VehicleType, number>) => {
    try {
      const saved = await api.updateTariffs(newTariffs);
      setTariffs((prev) => ({ ...prev, ...saved }));
    } catch (e) {
      showToast(errMsg(e));
    }
  };

  const availableCount = slots.filter((s) => s.status === 'available').length;
  const occupiedCount = slots.filter((s) => s.status === 'occupied').length;

  if (loadState !== 'ready') {
    return (
      <div className="min-h-screen bg-[#FDFCF8] flex items-center justify-center px-6 text-center">
        <div className="max-w-sm space-y-4">
          <div className="font-outfit text-2xl font-bold text-[#292524]">
            {loadState === 'loading' ? 'Connecting to ParkFlow…' : 'Could not load parking data'}
          </div>
          {loadState === 'error' && (
            <>
              <p className="text-sm text-stone-500">{loadError}</p>
              <button
                onClick={() => {
                  setLoadState('loading');
                  void refresh();
                }}
                className="py-2.5 px-6 rounded-full bg-[#FFB7B2] text-stone-900 font-outfit font-bold text-sm"
              >
                Try again
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#FDFCF8] text-[#292524] selection:bg-[#FFB7B2] selection:text-stone-900 pb-20">
      {/* 0.35 opacity SVG Noise Grain Overlay */}
      <GrainOverlay />

      {/* Floating Pill Navigation */}
      <Navbar
        currentView={currentView}
        onChangeView={setCurrentView}
        availableCount={availableCount}
        occupiedCount={occupiedCount}
      />

      {/* Main Content Area */}
      <main className="relative pt-24 sm:pt-28 max-w-5xl mx-auto px-4 sm:px-6 space-y-12">
        {/* Soft Toast Notification */}
        {notification && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-[#292524] text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-medium border border-stone-700">
              <CheckCircle2 className="w-4 h-4 text-[#FFB7B2]" />
              <span>{notification}</span>
            </div>
          </div>
        )}

        {/* HERO SECTION */}
        <section className="relative text-center pt-8 pb-10 sm:py-14 overflow-hidden">
          {/* Two large blurred background blobs (#FFE4E1 and #E6E6FA) at 60% opacity with floating animation */}
          <div
            className="absolute top-0 left-1/4 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-[#FFE4E1] opacity-60 blur-3xl pointer-events-none animate-soft-float"
            aria-hidden="true"
          />
          <div
            className="absolute top-12 right-1/4 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-[#E6E6FA] opacity-60 blur-3xl pointer-events-none animate-soft-float-slow"
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
            {/* Tag badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-stone-200/80 shadow-xs mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-stone-700 font-outfit uppercase tracking-wider">
                3 Floors • Smart Parking Management
              </span>
            </div>

            {/* Headline with Outfit & Reenie Beanie cursive */}
            <h1 className="font-outfit text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[#292524] leading-[1.08] max-w-2xl">
              Park your car,{' '}
              <span className="font-handwriting font-normal text-5xl sm:text-7xl md:text-8xl text-rose-500 inline-block px-1">
                softly
              </span>{' '}
              and with ease.
            </h1>

            {/* Sub-headline */}
            <p className="mt-4 text-base sm:text-lg text-[#78716C] max-w-[500px] leading-relaxed">
              Intelligent slot allocation across 3 floors, animated vehicle pathfinding, advance booking with overlap prevention, and automated fair billing in Rupees.
            </p>

            {/* Dual CTA buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => {
                  const lot = document.getElementById('live-parking-lot');
                  if (lot) lot.scrollIntoView({ behavior: 'smooth' });
                }}
                className="py-3.5 px-8 rounded-full bg-[#FFB7B2] text-stone-900 font-outfit font-bold text-sm sm:text-base hover:brightness-95 transition-all shadow-[0_4px_20px_-2px_rgba(255,183,178,0.5)] flex items-center gap-2"
              >
                <Car className="w-4 h-4 text-stone-800" />
                View Live Parking Floor
              </button>

              <button
                onClick={() => {
                  setCurrentView('user');
                  const desk = document.getElementById('dashboard-section');
                  if (desk) desk.scrollIntoView({ behavior: 'smooth' });
                }}
                className="py-3.5 px-7 rounded-full bg-white border border-stone-200 text-stone-800 font-outfit font-medium text-sm sm:text-base hover:bg-stone-50 transition-colors shadow-xs"
              >
                Reserve in Advance
              </button>
            </div>
          </div>
        </section>

        {/* LIVE ANIMATED PARKING LOT DISPLAY */}
        <section id="live-parking-lot" className="scroll-mt-24">
          <AnimatedParkingLot
            slots={slots}
            onSelectSlot={(slot) => setSelectedSlot(slot)}
            selectedSlotId={selectedSlot?.id}
            activeAnimation={activeAnimation}
            currentFloor={currentFloor}
            onChangeFloor={setCurrentFloor}
            isAdmin={currentView === 'admin'}
          />
        </section>

        {/* DASHBOARD SECTION: USER OR ADMIN PERSPECTIVE */}
        <section id="dashboard-section" className="scroll-mt-24 pt-4">
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <span className="font-handwriting text-2xl text-stone-500 block">
                {currentView === 'user' ? 'for drivers & commuters' : 'for security & gate managers'}
              </span>
              <h2 className="font-outfit text-2xl sm:text-3xl font-bold text-[#292524] tracking-tight">
                {currentView === 'user' ? 'User Booking & Ticket Portal' : 'Admin Gate & Operations Center'}
              </h2>
            </div>

            <button
              onClick={() => setCurrentView(currentView === 'user' ? 'admin' : 'user')}
              className="text-xs font-semibold px-4 py-2 rounded-full border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 transition-colors"
            >
              Switch to {currentView === 'user' ? 'Admin Gate' : 'User Portal'} →
            </button>
          </div>

          {currentView === 'user' ? (
            <UserDashboard
              slots={slots}
              reservations={reservations}
              receipts={receipts}
              onParkNow={handleParkVehicle}
              onCreateReservation={handleCreateReservation}
              onCancelReservation={handleCancelReservation}
              onExitVehicle={handleExitVehicle}
              onViewReceipt={(r) => setActiveReceipt(r)}
              preselectedSlotId={selectedSlot?.id}
              currentFloor={currentFloor}
              onChangeFloor={setCurrentFloor}
            />
          ) : (
            <AdminDashboard
              slots={slots}
              reservations={reservations}
              receipts={receipts}
              tariffs={tariffs}
              onUpdateTariffs={handleUpdateTariffs}
              onGateEntry={handleParkVehicle}
              onGateExit={handleExitVehicle}
              onToggleSlotMaintenance={handleToggleSlotMaintenance}
              onCancelReservation={handleCancelReservation}
              onCheckInReservation={handleCheckInReservation}
              onViewReceipt={(r) => setActiveReceipt(r)}
              currentFloor={currentFloor}
              onChangeFloor={setCurrentFloor}
            />
          )}
        </section>

        {/* HORIZONTAL SCENARIO SCROLL */}
        <ScenarioScroll />
      </main>

      {/* FOOTER */}
      <footer className="mt-20 border-t border-stone-200/80 bg-white/60 py-10 px-4 text-center">
        <div className="max-w-md mx-auto space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 rounded-full bg-[#FFB7B2] flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            </div>
            <span className="font-outfit font-bold text-stone-900 text-sm">Softly Park</span>
          </div>
          <p className="text-xs text-stone-400">
            A serene parking management system across 3 floors. All rates in Indian Rupees (₹).
          </p>
          <span className="font-handwriting text-xl text-stone-400 block pt-1">
            arrive calmly, leave refreshed
          </span>
        </div>
      </footer>

      {/* MODAL: SLOT ACTION & DETAILS */}
      <SlotActionModal
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
        onParkVehicle={handleParkVehicle}
        onExitVehicle={handleExitVehicle}
        onToggleMaintenance={handleToggleSlotMaintenance}
        reservations={reservations}
        onCancelReservation={handleCancelReservation}
        onCheckInReservation={handleCheckInReservation}
        onSwitchToReservationTab={(slotId) => {
          setCurrentView('user');
          const desk = document.getElementById('dashboard-section');
          if (desk) desk.scrollIntoView({ behavior: 'smooth' });
        }}
        isAdmin={currentView === 'admin'}
      />

      {/* MODAL: OFFICIAL RECEIPT IN RUPEES (₹) */}
      <ReceiptModal receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />
    </div>
  );
}
