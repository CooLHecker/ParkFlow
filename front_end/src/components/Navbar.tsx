/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User, Shield } from 'lucide-react';

interface NavbarProps {
  currentView: 'user' | 'admin';
  onChangeView: (view: 'user' | 'admin') => void;
  availableCount: number;
  occupiedCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onChangeView,
  availableCount,
  occupiedCount,
}) => {
  return (
    <header className="fixed top-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
      <nav
        aria-label="Main Navigation"
        className="pointer-events-auto w-full max-w-5xl bg-white/70 backdrop-blur-[20px] rounded-full px-4 sm:px-6 py-2.5 sm:py-3 border border-stone-200/80 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3 transition-all"
      >
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5">
          {/* Circular logo: Coral #FFB7B2 with white dot */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FFB7B2] flex items-center justify-center shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
          </div>
          <div>
            <span className="font-outfit font-bold text-stone-900 text-sm sm:text-base tracking-tight block leading-none">
              Softly<span className="text-[#FFB7B2]">.</span>Park
            </span>
            <span className="hidden sm:inline font-handwriting text-stone-500 text-xs leading-none">
              calm parking spaces
            </span>
          </div>
        </div>

        {/* View Switcher: User vs Admin */}
        <div className="flex items-center p-1 bg-stone-100/80 rounded-full border border-stone-200/60">
          <button
            onClick={() => onChangeView('user')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-outfit font-medium transition-all ${
              currentView === 'user'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            User View
          </button>
          <button
            onClick={() => onChangeView('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-outfit font-medium transition-all ${
              currentView === 'admin'
                ? 'bg-[#292524] text-white shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-[#FFB7B2]" />
            Admin Gate
          </button>
        </div>

        {/* Status Indicator & Live Floor Link */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-xs text-stone-500 pr-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{availableCount} slots open</span>
          </div>

          <button
            onClick={() => {
              const lotEl = document.getElementById('live-parking-lot');
              if (lotEl) lotEl.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-4 py-2 rounded-full bg-[#292524] text-white font-outfit font-medium text-xs sm:text-sm hover:bg-stone-800 transition-colors shadow-xs flex items-center gap-1.5"
          >
            <span>Live Floor</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </button>
        </div>
      </nav>
    </header>
  );
};
