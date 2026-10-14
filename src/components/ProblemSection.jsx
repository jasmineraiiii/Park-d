import React, { useState } from 'react';
import ChromaGrid from './ChromaGrid';
import { Navigation, EyeOff, Receipt, Flame, Cpu, Car, ArrowRight } from 'lucide-react';
import { createSvgImage } from '../data/problemImages';

const PROBLEMS_DATA = [
  {
    id: 'circling',
    number: '01',
    title: 'Circling Markets for 20+ Mins',
    shortTag: 'Sectors 17, 22 & 35 Gridlock',
    icon: Car,
    summary: 'Citizens spend 15 to 25 minutes circling around commercial sectors hunting for open parking spots, causing traffic jams and fatigue.',
    stat: '22 mins',
    statLabel: 'Average time wasted per trip',
    impact: 'Up to 30% of downtown traffic congestion is caused solely by citizens searching for parking.',
    cards: [
      {
        image: createSvgImage('Sector 17 & 22 Gridlock', 'Commercial Market Congestion', 'traffic'),
        title: 'Sector 17 & 22 Gridlock',
        subtitle: 'Endless loops through commercial parking corridors block arterial roads and waste expensive fuel.',
        accent: '#0284c7',
        tag: 'Sector Congestion'
      },
      {
        image: createSvgImage('Peak-Hour Chaos', 'Market Traffic Rush', 'traffic'),
        title: 'Peak-Hour Chaos',
        subtitle: 'Evenings and weekends see double-parking, blocked alleys, and horn-blowing gridlock.',
        accent: '#0369a1',
        tag: 'Peak Hours'
      }
    ]
  },
  {
    id: 'blind',
    number: '02',
    title: 'Zero Pre-Trip Visibility from Home',
    shortTag: 'Blind Departures',
    icon: EyeOff,
    summary: 'There is no way to check lot availability from home before turning the car ignition. Commuters leave blind and hope for an open space.',
    stat: '0%',
    statLabel: 'Pre-trip visibility today',
    impact: 'Citizens reach full parking lots with no alternative suggestions nearby.',
    cards: [
      {
        image: createSvgImage('Departing in the Dark', 'No Live Data Before Trip', 'nav'),
        title: 'Departing in the Dark',
        subtitle: 'No live status map exists for Municipal Corporation parking lots before you leave.',
        accent: '#0284c7',
        tag: 'Blind Departures'
      },
      {
        image: createSvgImage('No Alternative Guidance', 'Routing Void', 'nav'),
        title: 'No Alternative Guidance',
        subtitle: 'When primary lots are saturated, commuters receive zero live rerouting to open lots.',
        accent: '#0369a1',
        tag: 'Routing Void'
      }
    ]
  },
  {
    id: 'cash',
    number: '03',
    title: 'Paper Slips & Cash Overcharging',
    shortTag: 'Revenue Leakage & No Audit',
    icon: Receipt,
    summary: 'Fees are collected mostly in cash and logged on manual paper slips. Overcharging is common and municipal revenue is difficult to verify.',
    stat: '₹14 Flat',
    statLabel: 'Official rate distorted by cash slips',
    impact: 'Paper slips prevent financial transparency and result in unrecorded cash leakages.',
    cards: [
      {
        image: createSvgImage('Paper Slips & Cash Leaks', 'Manual Slips and Lost Receipts', 'cash'),
        title: 'Paper Slips & Cash Leaks',
        subtitle: 'Handwritten receipts offer no digital timestamps, verification codes, or municipal tracking.',
        accent: '#0284c7',
        tag: 'Manual Slips'
      },
      {
        image: createSvgImage('Opaque Fee Collection', 'Unverified Cash Leakage', 'cash'),
        title: 'Opaque Fee Collection',
        subtitle: 'Absence of direct UPI receipts makes auditing attendant collections near impossible.',
        accent: '#0369a1',
        tag: 'Cash Discrepancy'
      }
    ]
  },
  {
    id: 'pollution',
    number: '04',
    title: 'Excess Fuel Burn & Idling Emissions',
    shortTag: 'Air Quality & Carbon Waste',
    icon: Flame,
    summary: 'Vehicles crawling in 1st gear looking for parking burn excess fuel and release avoidable carbon emissions across Chandigarh’s green sectors.',
    stat: '15-20 mins',
    statLabel: 'Continuous vehicle idling time',
    impact: 'Thousands of liters of petrol and diesel wasted every single week looking for parking.',
    cards: [
      {
        image: createSvgImage('Idling Fuel Burn', 'Fuel Consumption in Stop & Go', 'emission'),
        title: 'Idling Fuel Burn',
        subtitle: 'Low-speed stop-and-go driving burns fuel at maximum consumption rates.',
        accent: '#0284c7',
        tag: 'Fuel Loss'
      },
      {
        image: createSvgImage('Air Quality Toll', 'Smog & Toxic Tailpipe Emissions', 'emission'),
        title: 'Air Quality Toll',
        subtitle: 'Avoidable exhaust smog trapped around busy pedestrian markets and shopping plazas.',
        accent: '#0369a1',
        tag: 'Smog Impact'
      }
    ]
  },
  {
    id: 'hardware',
    number: '05',
    title: 'The Expensive Camera & Sensor Trap',
    shortTag: 'Hardware Failure in Indian Roads',
    icon: Cpu,
    summary: 'Traditional smart parking projects demand crores in ground sensors, ANPR cameras, and wiring that rapidly fail under weather and road maintenance.',
    stat: '₹0 Crore',
    statLabel: "Park'd hardware budget needed",
    impact: 'Park’d uses existing attendants’ phones instead of fragile multi-crore sensor installations.',
    cards: [
      {
        image: createSvgImage('Pavement Sensor Breakdowns', 'Damaged Ground Hardware', 'sensor'),
        title: 'Pavement Sensor Breakdowns',
        subtitle: 'Pavement sensors fail from monsoon waterlogging, heat, and asphalt tar resurfacing.',
        accent: '#0284c7',
        tag: 'Maintenance Trap'
      },
      {
        image: createSvgImage('Zero-Hardware Alternative', 'Attendant Phone Mesh', 'sensor'),
        title: 'Zero-Hardware Alternative',
        subtitle: 'Convert existing ₹14 attendants into a live digital network with zero cameras needed.',
        accent: '#0369a1',
        tag: 'Pragmatic Tech'
      }
    ]
  }
];

export default function ProblemSection({ onTabSelect }) {
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const currentProblem = PROBLEMS_DATA[activeTabIdx];

  return (
    <section
      id="tab-problem"
      className="relative py-24 px-4 sm:px-6 lg:px-8 bg-slate-50/80 border-t border-sky-100 transition-opacity duration-700 ease-out"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="max-w-3xl mb-12 animate-fade-in">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Why Parking is Broken in Chandigarh
          </h2>
          <p className="text-base sm:text-lg text-slate-800 font-medium leading-relaxed">
            Existing municipal parking creates congestion, lost fuel, and opaque paper receipts. Select each bottleneck to explore the reality on the ground.
          </p>
        </div>

        {/* 5 Vertical Tabs & Dynamic Problem Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: 5 Vertical Tabs */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 px-2 mb-1">
              Select a Bottleneck (5 Key Issues)
            </div>

            {PROBLEMS_DATA.map((problem, idx) => {
              const isActive = activeTabIdx === idx;
              const Icon = problem.icon;

              return (
                <button
                  key={problem.id}
                  type="button"
                  onClick={() => setActiveTabIdx(idx)}
                  className={`w-full p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer flex items-center justify-between group border
                    ${
                      isActive
                        ? 'bg-white border-sky-500 shadow-md shadow-sky-500/10 ring-2 ring-sky-300'
                        : 'bg-white/80 hover:bg-white border-slate-200 hover:border-sky-300'
                    }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? 'bg-sky-600 text-white font-bold shadow-sm'
                          : 'bg-sky-50 text-sky-700 group-hover:bg-sky-100'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-sky-600">
                          {problem.number}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">
                          {problem.title}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-700 font-medium mt-0.5">{problem.shortTag}</p>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-4 h-4 transition-transform ${
                      isActive ? 'text-sky-600 translate-x-0.5' : 'text-slate-400 group-hover:text-slate-700'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Right Column: Problem Spotlight Showcase with Guaranteed Pictures and Dark Legible Text */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-sky-100 shadow-xl shadow-sky-500/5">
            {/* Top Stat & Title */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-600">
                  Bottleneck {currentProblem.number} Analysis
                </span>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                  {currentProblem.title}
                </h3>
              </div>

              <div className="text-right">
                <div className="text-2xl sm:text-3xl font-extrabold text-sky-600">
                  {currentProblem.stat}
                </div>
                <div className="text-[11px] text-slate-700 font-bold">{currentProblem.statLabel}</div>
              </div>
            </div>

            {/* Problem Summary (Dark, readable text) */}
            <p className="text-sm sm:text-base text-slate-900 leading-relaxed mb-6 font-medium">
              {currentProblem.summary}
            </p>

            <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 mb-6 text-xs text-slate-900 font-medium">
              <span className="font-bold text-sky-800">Civic Impact: </span>
              {currentProblem.impact}
            </div>

            {/* ChromaGrid Component with guaranteed vector pictures */}
            <div className="mb-6">
              <ChromaGrid
                items={currentProblem.cards}
                columns={2}
                minCardWidth={220}
                gap={16}
                radius={260}
                softness={0.6}
                damping={0.4}
                theme="light"
                frame={false}
                reveal="spotlight"
                glow={0.5}
                borderGlow={0.9}
                aspectRatio="16 / 10"
                cardRadius={18}
              />
            </div>

            {/* Action pill to Tab 3 */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                How does Park'd solve this?
              </span>

              <button
                type="button"
                onClick={() => onTabSelect('tab-solution')}
                className="px-5 py-2.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-500/20 cursor-pointer flex items-center gap-1.5"
              >
                <span>See Park'd Solution</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
