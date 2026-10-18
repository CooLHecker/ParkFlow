/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * Pixel-perfect SVG Indian Rupee (₹) symbol.
 * Guarantees crisp, consistent rendering across all platforms and headless environments.
 */
export const Rupee: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-label="Rupees"
    className={`inline-block w-[0.82em] h-[0.82em] -mt-0.5 align-middle ${className}`}
  >
    <path d="M6 3h12" />
    <path d="M6 8h12" />
    <path d="M6 13l8.5 8" />
    <path d="M6 13h3a4 4 0 0 0 0-8" />
  </svg>
);
