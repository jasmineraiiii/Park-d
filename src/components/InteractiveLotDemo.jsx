import React, { useState, useEffect } from 'react';
import { Smartphone, Shield, BarChart3, Car, Check, Clock, IndianRupee, RotateCcw, ArrowRight, AlertCircle } from 'lucide-react';

const INITIAL_SLOTS = Array.from({ length: 24 }, (_, i) => ({
  id: i + 1,
  status: i === 2 || i === 8 || i === 14 ? 'reserved' : i % 3 === 0 ? 'occupied' : 'free',
  driverName: i % 3 === 0 ? `CH-01-AB-${1000 + i}` : null
}));

export default function InteractiveLotDemo() {
  const [activeRole, setActiveRole] = useState('driver'); // 'driver' | 'attendant' | 'mc'
  const [slots, setSlots] = useState(INITIAL_SLOTS);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingCountdown, setBookingCountdown] = useState(null);
  const [auditLogs, setAuditLogs] = useState([
    { id: 1, time: '12:54', action: 'Slot #12 Assigned', actor: 'Attendant Rajesh K.', detail: '₹14 UPI' },
    { id: 2, time: '12:52', action: 'Slot #04 Released', actor: 'Attendant Rajesh K.', detail: 'Car Exited' },
    { id: 3, time: '12:50', action: 'Slot #09 Reserved', actor: 'Citizen (UPI Verified)', detail: '15m Lock' }
  ]);
  const [searchQuery, setSearchQuery] = useState('Sector 17');

  const totalSlots = slots.length;
  const freeSlots = slots.filter((s) => s.status === 'free').length;
  const occupiedSlots = slots.filter((s) => s.status === 'occupied').length;
  const reservedSlots = slots.filter((s) => s.status === 'reserved').length;
  const occupancyPct = Math.round(((totalSlots - freeSlots) / totalSlots) * 100);

  useEffect(() => {
    if (bookingCountdown === null) return;
    if (bookingCountdown <= 0) {
      setBookingCountdown(null);
      return;
    }
    const timer = setInterval(() => {
      setBookingCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [bookingCountdown]);

  const handleSlotTap = (slot) => {
    if (activeRole === 'driver') {
      if (slot.status === 'free') {
        setSelectedSlot(slot.id);
      }
      return;
    }

    if (activeRole === 'attendant') {
      let nextStatus = 'free';
      let actionText = '';
      if (slot.status === 'free') {
        nextStatus = 'occupied';
        actionText = `Slot #${slot.id} Assigned`;
      } else {
        nextStatus = 'free';
        actionText = `Slot #${slot.id} Marked Exited`;
      }

      setSlots((prev) =>
        prev.map((s) => (s.id === slot.id ? { ...s, status: nextStatus } : s))
      );

      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setAuditLogs((prev) => [
        {
          id: Date.now(),
          time: now,
          action: actionText,
          actor: 'Attendant Tap',
          detail: nextStatus === 'occupied' ? '₹14 Cash' : 'Exited'
        },
        ...prev.slice(0, 4)
      ]);
    }
  };

  const handleQuickAssign = (method) => {
    const nextFree = slots.find((s) => s.status === 'free');
    if (!nextFree) return;

    setSlots((prev) =>
      prev.map((s) => (s.id === nextFree.id ? { ...s, status: 'occupied' } : s))
    );

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setAuditLogs((prev) => [
      {
        id: Date.now(),
        time: now,
        action: `Assigned Slot #${nextFree.id}`,
        actor: 'Attendant 1-Tap',
        detail: `₹14 ${method}`
      },
      ...prev.slice(0, 4)
    ]);
  };

  const handleDriverReserve = () => {
    if (!selectedSlot) return;
    setSlots((prev) =>
      prev.map((s) => (s.id === selectedSlot ? { ...s, status: 'reserved' } : s))
    );
    setBookingCountdown(900);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setAuditLogs((prev) => [
      {
        id: Date.now(),
        time: now,
        action: `Reserved Slot #${selectedSlot}`,
        actor: 'Citizen App',
        detail: '₹14 UPI Ref #7821'
      },
      ...prev.slice(0, 4)
    ]);
    setSelectedSlot(null);
  };

  const handleReset = () => {
    setSlots(INITIAL_SLOTS);
    setBookingCountdown(null);
    setSelectedSlot(null);
  };

  return (
    <div className="rounded-3xl bg-white border border-sky-100 p-5 sm:p-8 shadow-xl shadow-sky-500/5">
      {/* Simulation Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-600">
              Live Interactive System
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            See How Citizens, Attendants & MC Sync in Real Time
          </h3>
        </div>

        {/* 3 Role Selector */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveRole('driver')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeRole === 'driver'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Citizen App</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveRole('attendant')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeRole === 'attendant'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Attendant App</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveRole('mc')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeRole === 'mc'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>MC Dashboard</span>
          </button>
        </div>
      </div>

      {/* Main Grid & Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6">
        {/* Left: Slot Grid */}
        <div className="lg:col-span-7 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Sector 17 — Plaza Lot</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  occupancyPct >= 85 ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {occupancyPct}% Full
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {activeRole === 'driver' && 'Tap any green slot to reserve for 30 minutes (₹14)'}
                {activeRole === 'attendant' && 'Tap any slot to toggle car entry or exit'}
                {activeRole === 'mc' && 'Live sensorless occupancy feed from attendants'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              title="Reset Lot"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Slots */}
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 mb-4">
            {slots.map((slot) => {
              const isSelected = selectedSlot === slot.id;
              const isFree = slot.status === 'free';
              const isOccupied = slot.status === 'occupied';
              const isReserved = slot.status === 'reserved';

              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => handleSlotTap(slot)}
                  className={`aspect-square rounded-xl p-1 flex flex-col items-center justify-center transition-all duration-200 border text-center cursor-pointer relative
                    ${isSelected ? 'ring-2 ring-sky-500 scale-105 z-10' : ''}
                    ${
                      isFree
                        ? 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-300 text-emerald-800'
                        : isOccupied
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600'
                        : 'bg-amber-50 hover:bg-amber-100/80 border-amber-300 text-amber-800'
                    }`}
                >
                  <span className="text-[10px] font-mono font-bold leading-none">
                    #{slot.id}
                  </span>
                  <div className="mt-1">
                    {isFree && <span className="text-[9px] uppercase font-bold text-emerald-700">Free</span>}
                    {isOccupied && <Car className="w-3 h-3 text-slate-500" />}
                    {isReserved && <Clock className="w-3 h-3 text-amber-600" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Free ({freeSlots})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                <span>Occupied ({occupiedSlots})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span>Reserved ({reservedSlots})</span>
              </span>
            </div>
            <span className="text-[11px] font-mono text-sky-700 font-bold">Standard ₹14 municipal fee</span>
          </div>
        </div>

        {/* Right: Dynamic Role View */}
        <div className="lg:col-span-5 bg-white border border-sky-100 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          {/* DRIVER VIEW */}
          {activeRole === 'driver' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-sky-700 font-bold">
                  Citizen Experience
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-semibold">
                  30-Min Lock
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Sector 17, 22, 35..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                />
                <span className="absolute right-3 top-2.5 text-[10px] text-emerald-700 font-bold">
                  {freeSlots} free
                </span>
              </div>

              {/* Selected Slot & Reserve Action */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Selected Slot:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {selectedSlot ? `Slot #${selectedSlot}` : 'Tap a green slot on grid'}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Fee (UPI / GPay / PhonePe):</span>
                  <span className="font-bold text-slate-900">₹14</span>
                </div>

                <button
                  type="button"
                  disabled={!selectedSlot}
                  onClick={handleDriverReserve}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer
                    ${
                      selectedSlot
                        ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-500/20'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                >
                  <span>Confirm ₹14 Reservation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {bookingCountdown !== null && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span>Active Reservation</span>
                    <span className="font-mono text-amber-700 text-sm">
                      {Math.floor(bookingCountdown / 60)}:
                      {String(bookingCountdown % 60).padStart(2, '0')}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Slot holds for 30 minutes. Automatically released if you don't arrive.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ATTENDANT VIEW */}
          {activeRole === 'attendant' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-sky-700 font-bold">
                  Attendant App
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                  Staff ID #41
                </span>
              </div>

              <p className="text-xs text-slate-600">
                1-tap actions assign the next free slot and record the ₹14 fee digitally.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleQuickAssign('Cash')}
                  className="p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold text-center transition-all cursor-pointer"
                >
                  <div className="text-[10px] text-emerald-600 font-semibold mb-0.5">1-Tap Fast Entry</div>
                  <div>New Car · Cash (₹14)</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickAssign('UPI')}
                  className="p-3 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-800 text-xs font-bold text-center transition-all cursor-pointer"
                >
                  <div className="text-[10px] text-sky-600 font-semibold mb-0.5">1-Tap Fast Entry</div>
                  <div>New Car · UPI (₹14)</div>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Attendant:</span>
                  <span className="font-semibold text-slate-900">Rajesh Kumar</span>
                </div>
                <div className="flex justify-between">
                  <span>Assigned Sector:</span>
                  <span className="font-semibold text-slate-900">Sector 17 Plaza</span>
                </div>
              </div>
            </div>
          )}

          {/* MC DASHBOARD VIEW */}
          {activeRole === 'mc' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-sky-700 font-bold">
                  MC Chandigarh Overview
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                  Live Sync Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">City Revenue Today</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-0.5">₹38,416</div>
                  <div className="text-[10px] text-sky-700 font-semibold mt-0.5">72% UPI · 28% Cash</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">City Saturation</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-0.5">{occupancyPct}%</div>
                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">18 Lots Online</div>
                </div>
              </div>
            </div>
          )}

          {/* Shared Real-Time Stream */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2 flex justify-between items-center">
              <span>Live Shared Activity</span>
              <span className="text-emerald-600 font-bold">Sync: Instant</span>
            </div>

            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1 text-[11px] font-mono">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-slate-700"
                >
                  <span className="text-sky-700 font-semibold truncate max-w-[140px]">{log.action}</span>
                  <span className="text-slate-500">{log.detail}</span>
                  <span className="text-[10px] text-slate-400">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
