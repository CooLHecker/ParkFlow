/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface Scenario {
  time: string;
  title: string;
  tag: string;
}

const SCENARIOS: Scenario[] = [
  {
    time: '08:30 AM',
    title: 'Morning commute: Reserved slot waiting on Floor 2, zero circling.',
    tag: 'Daily Commute',
  },
  {
    time: '11:15 AM',
    title: 'Touchless entry: slot allocated instantly as gate clears.',
    tag: 'Gate Inbound',
  },
  {
    time: '02:45 PM',
    title: 'Automated billing: fee computed to the minute with UPI QR payment.',
    tag: 'Smart Billing',
  },
  {
    time: '06:30 PM',
    title: 'Evening plans: advance booking prevents any slot conflict across floors.',
    tag: 'Dinner & Leisure',
  },
  {
    time: '09:00 PM',
    title: 'Night return: vehicle reverses out smoothly upon instant digital tap.',
    tag: 'Gentle Exit',
  },
];

export const ScenarioScroll: React.FC = () => {
  return (
    <section className="w-full py-8">
      <div className="flex items-center justify-between mb-4 px-2">
        <div>
          <span className="font-handwriting text-2xl text-stone-500 block">
            daily gentle journeys
          </span>
          <h4 className="font-outfit text-xl sm:text-2xl font-bold text-[#292524] tracking-tight">
            How Softly Park Unfolds
          </h4>
        </div>
        <span className="text-xs text-stone-400 font-medium">Scroll horizontally →</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x no-scrollbar">
        {SCENARIOS.map((s, idx) => (
          <div
            key={idx}
            className="group shrink-0 w-[288px] h-[160px] bg-white rounded-3xl p-5 border border-stone-200/80 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)] flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-md snap-start select-none cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-stone-400 font-medium">{s.time}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#E8EFE8] text-stone-700">
                {s.tag}
              </span>
            </div>

            <p className="text-base font-outfit font-semibold text-stone-800 leading-snug group-hover:text-rose-500 transition-colors">
              {s.title}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
