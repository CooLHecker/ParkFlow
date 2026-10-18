/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { Receipt } from '../types/parking.js';
import { formatCalmDateTime } from '../utils/parkingLogic.js';
import { CheckCircle2, Printer, X } from 'lucide-react';
import { Rupee } from './Rupee.js';

interface ReceiptModalProps {
  receipt: Receipt | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
        className="relative w-full max-w-md bg-[#FDFCF8] rounded-4xl p-6 sm:p-8 shadow-2xl border border-stone-200/90 max-h-[90vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close receipt"
          className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with aesthetic Softly styling */}
        <div className="text-center pb-5 border-b border-dashed border-stone-200">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#E8EFE8] text-emerald-700 mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 id="receipt-title" className="font-outfit text-2xl font-bold text-[#292524] tracking-tight">
            Softly Park Receipt
          </h2>
          <p className="text-xs text-[#78716C] mt-0.5">
            Receipt #{receipt.receiptNumber} • Paid in Full
          </p>
          <span className="font-handwriting text-stone-500 text-xl block mt-1">
            thank you for parking gently
          </span>
        </div>

        {/* Session Details */}
        <div className="py-4 space-y-3 text-sm">
          <div className="flex items-center justify-between text-stone-600">
            <span className="text-stone-500">Floor & Slot:</span>
            <span className="font-bold text-stone-900 px-2.5 py-0.5 bg-stone-100 rounded-full text-xs font-mono">
              {receipt.floor} • {receipt.slotLabel}
            </span>
          </div>

          <div className="flex items-center justify-between text-stone-600">
            <span className="text-stone-500">Vehicle Plate:</span>
            <span className="font-mono font-semibold text-stone-900 uppercase">
              {receipt.vehiclePlate}
            </span>
          </div>

          <div className="flex items-center justify-between text-stone-600">
            <span className="text-stone-500">Vehicle Type:</span>
            <span className="capitalize font-medium text-stone-900">
              {receipt.vehicleType}
            </span>
          </div>

          <div className="flex items-center justify-between text-stone-600">
            <span className="text-stone-500">Entry Time:</span>
            <span className="font-medium text-stone-800">{formatCalmDateTime(receipt.entryTime)}</span>
          </div>

          <div className="flex items-center justify-between text-stone-600">
            <span className="text-stone-500">Exit Time:</span>
            <span className="font-medium text-stone-800">{formatCalmDateTime(receipt.exitTime)}</span>
          </div>

          <div className="flex items-center justify-between text-stone-600">
            <span className="text-stone-500">Total Duration:</span>
            <span className="font-semibold text-stone-900">{receipt.durationFormatted}</span>
          </div>

          <div className="flex items-center justify-between text-stone-600">
            <span className="text-stone-500">Hourly Tariff Rate:</span>
            <span className="font-medium text-stone-800 flex items-center"><Rupee className="mr-0.5" />{receipt.hourlyTariff.toFixed(2)} / hr</span>
          </div>
        </div>

        {/* Financial Breakdown in Rupees (₹) */}
        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/60 my-3 space-y-2 text-sm">
          <div className="flex justify-between text-stone-600 text-xs">
            <span>Parking Subtotal</span>
            <span className="flex items-center"><Rupee className="mr-0.5" />{receipt.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-stone-600 text-xs">
            <span>Service Tax (8%)</span>
            <span className="flex items-center"><Rupee className="mr-0.5" />{receipt.tax.toFixed(2)}</span>
          </div>
          <div className="pt-2 border-t border-stone-200 flex justify-between items-center text-stone-900 font-bold">
            <span className="text-base">Total Amount Paid</span>
            <span className="text-xl text-[#292524] flex items-center"><Rupee className="mr-0.5" />{receipt.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div className="flex items-center justify-between text-xs text-stone-500 py-2">
          <span>Payment Method:</span>
          <span className="font-medium text-stone-800 bg-white px-2 py-0.5 rounded border border-stone-200">
            {receipt.paymentMethod}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full border border-stone-300 bg-white text-stone-800 text-sm font-semibold hover:bg-stone-50 transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4 text-stone-600" />
            Print Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-full bg-[#292524] text-white text-sm font-semibold hover:bg-stone-800 transition-colors shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
