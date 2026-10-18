/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { VehicleType } from '../types/parking.js';

interface CarSvgProps {
  type: VehicleType;
  color?: string;
  plate?: string;
  isHeadlightsOn?: boolean;
  isBraking?: boolean;
  className?: string;
}

export const CarSvg: React.FC<CarSvgProps> = ({
  type,
  color,
  plate,
  isHeadlightsOn = false,
  isBraking = false,
  className = '',
}) => {
  // Softly palette matching vehicle types (car and two-wheeler)
  const bodyColor = color || (type === 'two-wheeler' ? '#E59866' : '#576574');
  const roofColor = type === 'two-wheeler' ? '#BA68C8' : '#3d4853';

  if (type === 'two-wheeler') {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        <svg viewBox="0 0 40 70" className="w-8 h-14 drop-shadow-sm">
          {/* Rear tire */}
          <rect x="17" y="52" width="6" height="14" rx="2" fill="#292524" />
          {/* Front tire */}
          <rect x="17" y="4" width="6" height="12" rx="2" fill="#292524" />
          {/* Body frame */}
          <path d="M14 20 Q12 36 14 50 L26 50 Q28 36 26 20 Z" fill={bodyColor} />
          {/* Seat */}
          <rect x="15" y="32" width="10" height="18" rx="4" fill="#292524" />
          {/* Handlebars */}
          <rect x="8" y="14" width="24" height="3" rx="1.5" fill="#78716C" />
          <circle cx="8" cy="15.5" r="2.5" fill="#292524" />
          <circle cx="32" cy="15.5" r="2.5" fill="#292524" />
          {/* Headlight */}
          <circle cx="20" cy="10" r="3.5" fill={isHeadlightsOn ? '#FEF08A' : '#FDFCF8'} stroke="#A8A29E" strokeWidth="1" />
          {/* Taillight */}
          <rect x="17" y="50" width="6" height="2" rx="1" fill={isBraking ? '#EF4444' : '#DC2626'} />
        </svg>
        {plate && (
          <span className="absolute -bottom-2 text-[9px] font-mono tracking-tighter bg-white/95 px-1 py-0.2 rounded border border-stone-200 text-stone-800 shadow-xs pointer-events-none">
            {plate}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      <svg viewBox="0 0 54 96" className="w-12 h-20 drop-shadow-md">
        {/* Headlight beams if on */}
        {isHeadlightsOn && (
          <path
            d="M 12 0 L 2 0 L 10 16 Z M 42 0 L 52 0 L 44 16 Z"
            fill="url(#headlightGlow)"
            opacity="0.6"
          />
        )}
        <defs>
          <linearGradient id="headlightGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FEF08A" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 4 Tires */}
        <rect x="2" y="16" width="6" height="15" rx="2" fill="#1C1917" />
        <rect x="46" y="16" width="6" height="15" rx="2" fill="#1C1917" />
        <rect x="2" y="66" width="6" height="15" rx="2" fill="#1C1917" />
        <rect x="46" y="66" width="6" height="15" rx="2" fill="#1C1917" />

        {/* Main Chassis Body */}
        <rect x="6" y="8" width="42" height="80" rx="12" fill={bodyColor} />

        {/* Front & Rear Bumpers */}
        <path d="M 12 8 Q 27 6 42 8" stroke="#1C1917" strokeWidth="1.5" fill="none" opacity="0.4" />
        <path d="M 12 88 Q 27 90 42 88" stroke="#1C1917" strokeWidth="1.5" fill="none" opacity="0.4" />

        {/* Side mirrors */}
        <rect x="1" y="24" width="5" height="4" rx="2" fill={bodyColor} />
        <rect x="48" y="24" width="5" height="4" rx="2" fill={bodyColor} />

        {/* Front Windshield */}
        <path d="M 11 26 L 15 16 Q 27 15 39 16 L 43 26 Q 27 28 11 26 Z" fill="#292524" opacity="0.85" />

        {/* Cabin Roof */}
        <rect x="11" y="27" width="32" height="38" rx="5" fill={roofColor} />

        {/* Panoramic Glass or Sunroof */}
        <rect x="15" y="32" width="24" height="24" rx="4" fill="#383230" opacity="0.4" />

        {/* Rear Windshield */}
        <path d="M 12 66 L 16 75 Q 27 76 38 75 L 42 66 Q 27 65 12 66 Z" fill="#292524" opacity="0.85" />

        {/* Headlights */}
        <circle cx="12" cy="11" r="3" fill={isHeadlightsOn ? '#FEF08A' : '#FFFFFF'} opacity="0.9" />
        <circle cx="42" cy="11" r="3" fill={isHeadlightsOn ? '#FEF08A' : '#FFFFFF'} opacity="0.9" />

        {/* Taillights */}
        <rect x="11" y="84" width="7" height="3" rx="1.5" fill={isBraking ? '#EF4444' : '#DC2626'} />
        <rect x="36" y="84" width="7" height="3" rx="1.5" fill={isBraking ? '#EF4444' : '#DC2626'} />
      </svg>

      {/* Mini License Tag */}
      {plate && (
        <span className="absolute -bottom-2 text-[9px] font-mono font-medium tracking-tight bg-white/95 px-1.5 py-0.5 rounded-full border border-stone-200 text-stone-800 shadow-xs pointer-events-none">
          {plate}
        </span>
      )}
    </div>
  );
};
