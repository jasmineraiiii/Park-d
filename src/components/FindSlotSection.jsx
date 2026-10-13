import React, { useState, useMemo, useEffect, useRef } from 'react';
import TextType from './TextType';
import { api, sectorLabel, useLive } from '../lib/api';
import {
  Search,
  MapPin,
  Compass,
  Flame,
  Calendar,
  Navigation,
  Clock,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Car
} from 'lucide-react';

// Hook: fade-in when element enters viewport
function useFadeIn(delay = 0) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.animationDelay = `${delay}s`;
          el.classList.add('animate-fade-in');
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);
  return ref;
}

// Sample data, shown only when the Park'd server can't be reached (labelled "Simulated live data").
const PARKING_LOTS = [
  {
    id: 'sec-22-d',
    name: 'Sector 22-D Market Parking',
    location: 'Sector 22 · Near Kiran Cinema, Sector 22-D',
    sector: '22',
    freeSlots: 14,
    totalSlots: 40,
    fee: '₹14/entry',
    reservable: 4,
    isOpen: true,
    isPopular: true
  },
  {
    id: 'shastri-market',
    name: 'Shastri Market Parking',
    location: 'Sector 22 · Shastri Market, Sector 22-B',
    sector: '22',
    freeSlots: 7,
    totalSlots: 60,
    fee: '₹14/entry',
    reservable: 6,
    isOpen: true,
    isPopular: true
  },
  {
    id: 'sec-17-multilevel',
    name: 'Sector 17 Multi-Level Parking',
    location: 'Sector 17 · Near Sector 17 bus stand, Sector 17',
    sector: '17',
    freeSlots: 11,
    totalSlots: 96,
    fee: '₹14/entry',
    reservable: 9,
    isOpen: true,
    isPopular: true
  },
  {
    id: 'neelam-cinema',
    name: 'Neelam Cinema Parking',
    location: 'Sector 17 · Near Neelam Cinema, Sector 17',
    sector: '17',
    freeSlots: 9,
    totalSlots: 40,
    fee: '₹14/entry',
    reservable: 4,
    isOpen: true,
    isPopular: false
  },
  {
    id: 'sec-35-c',
    name: 'Sector 35-C Commercial Market',
    location: 'Sector 35 · Main Market, Sector 35-C',
    sector: '35',
    freeSlots: 18,
    totalSlots: 50,
    fee: '₹14/entry',
    reservable: 5,
    isOpen: true,
    isPopular: true
  },
  {
    id: 'sukhna-lake',
    name: 'Sukhna Lake Promenade Lot',
    location: 'Sukhna Lake · Promenade Road, Sector 6',
    sector: '6',
    freeSlots: 32,
    totalSlots: 120,
    fee: '₹14/entry',
    reservable: 12,
    isOpen: true,
    isPopular: true
  }
];

// Availability colors use the number of spaces a driver can actually choose.
const PLENTY_FREE_SLOTS = 12;

// Maps a lot from the Park'd API onto the shape this section already renders.
const fromApi = (l) => ({
  id: l._id, name: l.name, location: `${sectorLabel(l.sector)} · ${l.address}`, sector: String(l.sector),
  freeSlots: l.stats.available, totalSlots: l.capacity, fee: `₹${l.feeInr}/entry`, feeInr: l.feeInr,
  reservable: l.stats.reservableFree, isOpen: l.stats.open, isPopular: Boolean(l.popular), lat: l.lat, lng: l.lng,
  temporary: l.kind === 'temporary',
});

export default function FindSlotSection({ onTabSelect, onOpenAuth }) {
  const [liveLots, setLiveLots] = useState(null); // null = server not reached → sample data
  useEffect(() => { api('GET', '/lots').then((r) => setLiveLots(r.lots.map(fromApi))).catch(() => setLiveLots(null)); }, []);
  useLive({ 'lot:update': (s) => setLiveLots((ls) => ls && ls.map((l) => (l.id === s.lotId ? { ...l, freeSlots: s.available, reservable: s.reservableFree, isOpen: s.open } : l))) });
  
  // Exactly 6 curated spaces on the landing page ensuring every filter has matching results:
  // - All Parking (all 6)
  // - Near Me / Sec 17 & 22 (Sector 17 Multi-Level, Shastri Market, Neelam Cinema, Sector 22-D)
  // - Popular Sectors / 17, 22, 35, 8 (Sector 17 Multi-Level, Shastri Market, Sector 35-C, Sector 8)
  // - Reserved Parking / reservable > 0 (Sector 17 Multi-Level, Sector 35-C, Shastri Market, Sector 22-D)
  const baseLots = useMemo(() => {
    if (liveLots && liveLots.length > 0) {
      // Pick curated 6 from live backend if available, or first 6
      const desiredIds = ['s17-ml', 's22-shastri', 's35-c', 's8-inner', 's17-neelam', 's22-kiran'];
      const picked = desiredIds.map(id => liveLots.find(l => l.id === id)).filter(Boolean);
      if (picked.length === 6) return picked;
      return liveLots.slice(0, 6);
    }
    return PARKING_LOTS;
  }, [liveLots]);

  const allLots = liveLots ?? PARKING_LOTS;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedLot, setSelectedLot] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [isViewAllOpen, setIsViewAllOpen] = useState(false);
  const [viewAllSearch, setViewAllSearch] = useState('');
  const [viewAllFilter, setViewAllFilter] = useState('all');

  // Fade refs
  const leftRef  = useFadeIn(0.05);
  const badgeRef = useFadeIn(0.05);
  const titleRef = useFadeIn(0.15);
  const subtitleRef = useFadeIn(0.25);
  const card1Ref = useFadeIn(0.30);
  const card2Ref = useFadeIn(0.40);
  const card3Ref = useFadeIn(0.50);
  const rightRef = useFadeIn(0.20);

  // Filter lots based on search query and active filter (capped to 6 on landing card view)
  const filteredLots = useMemo(() => {
    return baseLots.filter((lot) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        lot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lot.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lot.sector.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeFilter === 'popular') return lot.isPopular;
      if (activeFilter === 'reserved') return lot.reservable > 0;
      if (activeFilter === 'near') return lot.sector === '17' || lot.sector === '22';
      return true;
    }).slice(0, 6);
  }, [searchQuery, activeFilter, baseLots]);

  // Modal full lots filter
  const modalFilteredLots = useMemo(() => {
    return allLots.filter((lot) => {
      const matchesSearch =
        viewAllSearch.trim() === '' ||
        lot.name.toLowerCase().includes(viewAllSearch.toLowerCase()) ||
        lot.location.toLowerCase().includes(viewAllSearch.toLowerCase()) ||
        lot.sector.toLowerCase().includes(viewAllSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (viewAllFilter === 'popular') return lot.isPopular;
      if (viewAllFilter === 'reserved') return lot.reservable > 0;
      if (viewAllFilter === 'near') return lot.sector === '17' || lot.sector === '22';
      return true;
    });
  }, [viewAllSearch, viewAllFilter, allLots]);

  const handleOpenLot = (lot, type = 'view') => {
    setSelectedLot(lot);
    setModalType(type);
  };

  const handleCloseModal = () => {
    setSelectedLot(null);
    setModalType(null);
  };

  return (
    <section
      id="tab-problem"
      className="relative py-20 px-4 sm:px-6 lg:px-8 bg-slate-50/70 border-t border-sky-100 transition-opacity duration-700 ease-out"
    >
      <div className="max-w-7xl mx-auto">
        {/* Split Layout: Left Side (TextType & Info) vs Right Side (Interactive Screenshot UI) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* LEFT SIDE */}
          <div ref={leftRef} className="lg:col-span-5 space-y-6 lg:sticky lg:top-24" style={{opacity:0}}>
            <div>
              <div ref={badgeRef} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-semibold mb-4 border border-sky-200" style={{opacity:0}}>
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Live Municipal Lot Search</span>
              </div>

              <h2 ref={titleRef} className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-3" style={{opacity:0}}>
                Find a parking slot
              </h2>

              {/* React Bits TextType Component Integration */}
              <div className="h-16 sm:h-20 flex items-center">
                <TextType
                  text={[
                    'in Sector 17 Multi-Level...',
                    'near Shastri Market, Sector 22...',
                    'at Neelam Cinema Plaza...',
                    'in Sector 35-C Commercial...',
                    'before leaving home.'
                  ]}
                  typingSpeed={55}
                  pauseDuration={1600}
                  deletingSpeed={30}
                  showCursor={true}
                  cursorCharacter="|"
                  cursorClassName="text-sky-600 font-bold text-2xl sm:text-3xl"
                  className="text-xl sm:text-3xl font-bold text-sky-600"
                />
              </div>
            </div>

            <p ref={subtitleRef} className="text-sm sm:text-base text-slate-700 font-medium leading-relaxed" style={{opacity:0}}>
              Never circle aimlessly again. Explore real-time vacancy numbers across all Municipal Corporation lots in Chandigarh before turning your car ignition.
            </p>

            {/* Quick feature highlights */}
            <div className="space-y-3 pt-2">
              <div ref={card1Ref} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-sky-100 shadow-xs" style={{opacity:0}}>
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Live Occupancy Mesh</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Attendants tap their phone on entry and exit. Slot counters drop and rise instantly for all drivers.
                  </p>
                </div>
              </div>

              <div ref={card2Ref} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-sky-100 shadow-xs" style={{opacity:0}}>
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">10% Pre-Booking Hold</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Guaranteed 15-minute hold for ₹14 via UPI (Google Pay, PhonePe, Paytm). 90% stays preserved for walk-ins.
                  </p>
                </div>
              </div>

              <div ref={card3Ref} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-sky-100 shadow-xs" style={{opacity:0}}>
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Zero Hardware Overhead</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    No fragile ground sensors or ANPR cameras. 100% human-verified attendant mesh.
                  </p>
                </div>
              </div>
            </div>

            {/* Jump button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onTabSelect('tab-solution')}
                className="inline-flex items-center gap-2 text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
              >
                <span>Learn how the 3-app architecture works</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div ref={rightRef} className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-7 border border-sky-100 shadow-xl shadow-sky-500/5" style={{opacity:0}}>
            {/* Top Sub-Bar: Chandigarh Location Label */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800">
                <MapPin className="w-3.5 h-3.5 text-sky-600" />
                <span>Chandigarh</span>
              </div>
            </div>

            {/* Sub-Header Heading */}
            <div className="mt-5 mb-5">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Let's find your parking spot.
              </h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                <span>Live parking availability across Chandigarh.</span>
              </div>
            </div>

            {/* Functional Search Bar */}
            <div className="relative mb-5 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sector, landmark or parking lot.."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {}}
                className="px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-sky-500/20 transition-all cursor-pointer whitespace-nowrap"
              >
                Search
              </button>
            </div>

            {/* 4 Functional Filter Buttons (Matching screenshot tabs) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  activeFilter === 'all'
                    ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-300'
                    : 'bg-slate-50/70 border-slate-200/80 hover:bg-white'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sky-600 text-xs font-bold mb-2 shadow-2xs">
                  P
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">All Parking</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">17 lots</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('near')}
                className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  activeFilter === 'near'
                    ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-300'
                    : 'bg-slate-50/70 border-slate-200/80 hover:bg-white'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sky-600 text-xs font-bold mb-2 shadow-2xs">
                  <Compass className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Near Me</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Use location</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('popular')}
                className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  activeFilter === 'popular'
                    ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-300'
                    : 'bg-slate-50/70 border-slate-200/80 hover:bg-white'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sky-600 text-xs font-bold mb-2 shadow-2xs">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Popular Sectors</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">17 · 22 · 35 · 8</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('reserved')}
                className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  activeFilter === 'reserved'
                    ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-300'
                    : 'bg-slate-50/70 border-slate-200/80 hover:bg-white'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sky-600 text-xs font-bold mb-2 shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-sky-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Reserved Parking</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Book ahead</div>
                </div>
              </button>
            </div>

            {/* "Parking near you" Section Label & View all */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-base font-extrabold text-slate-900">Parking near you</h4>
                <p className="text-[11px] text-slate-500">Open now, near the city centre</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setViewAllSearch('');
                  setViewAllFilter('all');
                  setIsViewAllOpen(true);
                }}
                className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-0.5 cursor-pointer"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Location Notice Banner */}
            <div className="p-3 rounded-2xl bg-sky-50/80 border border-sky-200/80 mb-5 flex items-center gap-2.5 text-xs text-sky-900 font-medium">
              <Compass className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                <strong className="text-sky-800">Set your location</strong> to see distances and drive times. GPS is optional.
              </span>
            </div>

            {/* Parking Lot Cards Grid (Functional Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredLots.map((lot) => {
                const fullness = Math.round(((lot.totalSlots - lot.freeSlots) / lot.totalSlots) * 100);
                const isPlenty = lot.freeSlots >= PLENTY_FREE_SLOTS;
                const isFull = lot.freeSlots === 0;

                return (
                  <div
                    key={lot.id}
                    className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/90 hover:border-sky-300 hover:bg-white transition-all shadow-2xs hover:shadow-md flex flex-col justify-between"
                  >
                    <div>
                      {/* Name & Total Slots Header */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h5 className="text-sm font-bold text-slate-900 leading-snug">{lot.name}</h5>
                        <div className="text-right shrink-0">
                          <span className="text-base font-extrabold text-slate-900">{lot.freeSlots}</span>
                          <span className="text-xs text-slate-500">/{lot.totalSlots}</span>
                          <div className="text-[9px] text-slate-400 font-semibold uppercase">slots free</div>
                        </div>
                      </div>

                      {/* Location text */}
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mb-3">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{lot.location}</span>
                      </p>

                      {/* Badges / Metrics */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isFull
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : isPlenty
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {lot.freeSlots} free · {isFull ? 'Full' : isPlenty ? 'Plenty' : 'Limited'}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {fullness}% full
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {lot.fee}
                        </span>
                      </div>

                      {/* Open status & reservable quota */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium mb-3">
                        {lot.isOpen ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Open
                        </span>
                        ) : (
                        <span className="flex items-center gap-1 text-slate-500 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          Closed now
                        </span>
                        )}
                        {lot.temporary && <span className="px-1.5 py-0.5 rounded-full bg-yellow-300 text-yellow-950 text-[9px] font-bold">TEMPORARY</span>}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{lot.reservable} reservable</span>
                        </span>
                      </div>

                      {/* Visual capacity progress bar */}
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-4">
                        <div
                          className={`h-full rounded-full ${
                            isFull ? 'bg-red-500' : isPlenty ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${fullness}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenLot(lot, 'view')}
                        className="py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer text-center"
                      >
                        View parking
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenLot(lot, 'directions')}
                        className="py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Navigation className="w-3 h-3 text-sky-600" />
                        <span>Directions</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredLots.length === 0 && (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No parking lots found matching your filter</p>
                <p className="text-xs text-slate-500 mt-0.5">Try searching for "Sector 17", "22", or clear the search query.</p>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
                  className="mt-3 px-4 py-1.5 rounded-full bg-sky-600 text-white text-xs font-bold"
                >
                  Reset Search
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Modal for "View Parking" and "Get Directions" */}
      {selectedLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-sky-100 relative">
            <button
              type="button"
              onClick={handleCloseModal}
              className="absolute right-4 top-4 p-1 rounded-full text-slate-400 hover:text-slate-600 bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>

            {modalType === 'view' ? (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
                  <Car className="w-3.5 h-3.5" />
                  <span>Municipal Lot Verification</span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedLot.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedLot.location}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Available Slots</div>
                    <div className="text-2xl font-extrabold text-emerald-600">{selectedLot.freeSlots} <span className="text-xs text-slate-500 font-normal">/ {selectedLot.totalSlots}</span></div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Municipal Fee</div>
                    <div className="text-2xl font-extrabold text-slate-900">₹{selectedLot.feeInr ?? 14}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-sky-50 text-xs text-sky-900 font-medium">
                  <strong>15-Minute Reservation:</strong> Holds 1 guaranteed slot for ₹14 via UPI. {selectedLot.reservable} pre-book slots remaining right now.
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseModal();
                      onOpenAuth?.();
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-500/25"
                  >
                    Sign in to hold · ₹{selectedLot.feeInr ?? 14}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Navigation Guidance</span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900">Routing to {selectedLot.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedLot.location}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span>Drive time:</span>
                    <span className="font-bold text-slate-900">Shown in Google Maps (live traffic)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Vacancy:</span>
                    <span className="font-bold text-emerald-600">{selectedLot.freeSlots} Open Slots</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GPS Navigation:</span>
                    <span className="font-bold text-sky-600">Google Maps / Apple Maps</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    window.open(selectedLot.lat ? `https://www.google.com/maps/dir/?api=1&destination=${selectedLot.lat},${selectedLot.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedLot.name + ' Chandigarh')}`, '_blank');
                    handleCloseModal();
                  }}
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-500/25 flex items-center justify-center gap-2"
                >
                  <span>Launch Google Maps Route</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Window Modal for "View all" Parking Slots */}
      {isViewAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-sky-100 overflow-hidden relative">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold mb-1">
                  <MapPin className="w-3 h-3 text-sky-600" />
                  <span>Chandigarh Smart Parking Network</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  All Municipal Parking Locations
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {modalFilteredLots.length} parking locations across Chandigarh
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsViewAllOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Search Bar within Modal */}
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-white shrink-0 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={viewAllSearch}
                  onChange={(e) => setViewAllSearch(e.target.value)}
                  placeholder="Search sector, landmark or parking lot..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                />
                {viewAllSearch && (
                  <button
                    type="button"
                    onClick={() => setViewAllSearch('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'all', label: 'All Lots', count: allLots.length },
                  { id: 'near', label: 'Near Me (Sec 17 & 22)', count: allLots.filter(l => l.sector === '17' || l.sector === '22').length },
                  { id: 'popular', label: 'Popular Sectors', count: allLots.filter(l => l.isPopular).length },
                  { id: 'reserved', label: 'Book Ahead (Reservable)', count: allLots.filter(l => l.reservable > 0).length },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setViewAllFilter(f.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      viewAllFilter === f.id
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${viewAllFilter === f.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>{f.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Lot Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/40">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {modalFilteredLots.map((lot) => {
                  const fullness = Math.round(((lot.totalSlots - lot.freeSlots) / lot.totalSlots) * 100);
                  const isPlenty = lot.freeSlots >= PLENTY_FREE_SLOTS;
                  const isFull = lot.freeSlots === 0;

                  return (
                    <div
                      key={`modal-${lot.id}`}
                      className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-sky-300 transition-all shadow-2xs hover:shadow-md flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h5 className="text-sm font-bold text-slate-900 leading-snug">{lot.name}</h5>
                          <div className="text-right shrink-0">
                            <span className="text-base font-extrabold text-slate-900">{lot.freeSlots}</span>
                            <span className="text-xs text-slate-500">/{lot.totalSlots}</span>
                            <div className="text-[9px] text-slate-400 font-semibold uppercase">free</div>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mb-2.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{lot.location}</span>
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                              isFull
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : isPlenty
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {lot.freeSlots} free · {isFull ? 'Full' : isPlenty ? 'Plenty' : 'Limited'}
                          </span>
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {fullness}% full
                          </span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                            {lot.fee}
                          </span>
                        </div>

                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-3">
                          <div
                            className={`h-full rounded-full ${
                              isFull ? 'bg-red-500' : isPlenty ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${fullness}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setIsViewAllOpen(false);
                            handleOpenLot(lot, 'view');
                          }}
                          className="py-1.5 px-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer text-center"
                        >
                          View parking
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            window.open(lot.lat ? `https://www.google.com/maps/dir/?api=1&destination=${lot.lat},${lot.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lot.name + ' Chandigarh')}`, '_blank');
                          }}
                          className="py-1.5 px-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Navigation className="w-3 h-3 text-sky-600" />
                          <span>Directions</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {modalFilteredLots.length === 0 && (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 mt-4">
                  <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">No parking locations found</p>
                  <p className="text-xs text-slate-500 mt-0.5">Try clearing the search query or changing filter.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
