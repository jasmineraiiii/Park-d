import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Car,
  Activity,
  CreditCard,
  Clock,
  ShieldCheck,
  Search,
  LogOut,
  MapPin,
  TrendingUp,
  Server,
  Radio,
  Sparkles,
  Navigation,
  RefreshCw,
  Bell,
  Home,
  Compass,
  CalendarCheck,
  User,
  ParkingSquare,
  Users,
  BarChart3,
  Map,
  ScrollText,
  Plug2,
  ClipboardList,
  ShieldAlert,
  ChevronRight,
  Wallet,
  Check,
  PartyPopper,
  House,
  KeyRound,
  LocateFixed,
  TriangleAlert
} from 'lucide-react';
import {
  api, dateTime, directionsUrl, downloadCsv, duration, inr, level, sectorLabel, time, UPI_APPS, useLive, useLoad
} from '../lib/api';
import LiveMap from './LiveMap';
import NotificationBell from './NotificationBell';
import DriverFestival from './dash/DriverFestival';
import DriverNeighbourhood from './dash/DriverNeighbourhood';
import DriverHost from './dash/DriverHost';
import AdminFestival from './dash/AdminFestival';
import AdminNeighbourhood from './dash/AdminNeighbourhood';
import { Btn, ErrorNote, Field, inputCls, Loading, Modal, Pill } from './dash/ui';

/* ──────────────────────────────────────────────────────────────────────────
   SIDEBAR DEFINITIONS (per role)
   UI role → backend role: driver → driver, worker → attendant, developer → MC admin
────────────────────────────────────────────────────────────────────────── */
const SIDEBAR_ITEMS = {
  driver: [
    { id: 'home',          label: 'Home',          Icon: Home },
    { id: 'explore',       label: 'Explore',       Icon: Compass },
    { id: 'festival',      label: 'Festival Mode', Icon: PartyPopper },
    { id: 'neighbourhood', label: 'Neighbourhood', Icon: House },
    { id: 'reservations',  label: 'Reservations',  Icon: CalendarCheck },
    { id: 'mycar',         label: 'My Car',        Icon: Car },
    { id: 'host',          label: 'Host a Space',  Icon: KeyRound },
    { id: 'profile',       label: 'Profile',       Icon: User }
  ],
  worker: [
    { id: 'home',     label: 'Home',          Icon: Home },
    { id: 'mylot',    label: 'My Lot',        Icon: ParkingSquare },
    { id: 'queue',    label: 'Vehicle Queue', Icon: Car },
    { id: 'report',   label: 'Daily Report',  Icon: ClipboardList },
    { id: 'barrier',  label: 'Barrier Ctrl',  Icon: ShieldAlert }
  ],
  developer: [
    { id: 'home',          label: 'Home',           Icon: Home },
    { id: 'analytics',     label: 'Analytics',      Icon: BarChart3 },
    { id: 'festival',      label: 'Festival Mode',  Icon: PartyPopper },
    { id: 'neighbourhood', label: 'Neighbourhood',  Icon: House },
    { id: 'allots',        label: 'All Lots Map',   Icon: Map },
    { id: 'logs',          label: 'System Logs',    Icon: ScrollText },
    { id: 'users',         label: 'User Mgmt',      Icon: Users },
    { id: 'api',           label: 'API Health',     Icon: Plug2 }
  ]
};

/* ──────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
────────────────────────────────────────────────────────────────────────── */
export default function Dashboard({ user, onLogout }) {
  const role     = user?.role     || 'developer';
  const me       = user?.user     || {};
  const userName = (me.name === 'Demo Driver' ? 'Demo Citizen' : me.name) || user?.fullName || (role === 'developer' ? 'Govt Systems Admin' : role === 'worker' ? 'Attendant' : 'Citizen');
  const govtPassId = me.username || user?.govtPassId || '';

  const [sidebarTab,   setSidebarTab]   = useState('home');
  const [notification, setNotification] = useState(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(false); // mobile toggle
  const [headerQuery,  setHeaderQuery]  = useState('');
  const [searchFor,    setSearchFor]    = useState('');     // query handed to Explore / slot / lot search
  const [deepLink,     setDeepLink]     = useState({});     // { zoneId, bookingId } opened from notifications
  const [viewLotId,    setViewLotId]    = useState(null);   // driver: slot viewer for any lot or zone
  const [barrierOpen,  setBarrierOpen]  = useState(false);  // demo only: no gate hardware is connected
  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 15000); return () => clearInterval(t); }, []);

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  /* ── live data shared by several panels ── */
  const activity = useLoad(() => (role === 'driver' ? api('GET', '/me/activity') : Promise.resolve(null)), [role]);
  const nbBookings = useLoad(() => (role === 'driver' ? api('GET', '/neighbourhood-bookings') : Promise.resolve(null)), [role]);
  const lots = useLoad(() => (role === 'worker' ? api('GET', '/attendant/lots') : api('GET', '/lots')), [role]);
  const overview = useLoad(() => (role === 'developer' ? api('GET', '/admin/overview') : Promise.resolve(null)), [role]);
  const [workerLotId, setWorkerLotId] = useState(null);
  const lotList = lots.data?.lots ?? [];
  useEffect(() => { if (role === 'worker' && !workerLotId && lotList[0]) setWorkerLotId(lotList[0]._id); }, [role, lotList, workerLotId]);
  const workerLot = lotList.find((l) => l._id === workerLotId) || null;

  useLive({
    'lot:update': (s) => {
      lots.setData((d) => (d ? { ...d, lots: d.lots.map((l) => (l._id === s.lotId ? { ...l, stats: s } : l)) } : d));
      if (role === 'developer') { clearTimeout(window.__pkOv); window.__pkOv = setTimeout(overview.reload, 2500); }
    },
    'zone:update': () => lots.reload(),
    'festival:update': () => lots.reload(),
  });

  const handleToggleBarrier = () => {
    setBarrierOpen(prev => !prev);
    showToast(barrierOpen ? 'Barrier closed (demo — no gate hardware connected)' : 'Barrier opened (demo — no gate hardware connected)');
  };

  /* header search: drivers → Explore, workers → slot search, MC → lot list */
  const runHeaderSearch = (e) => {
    e.preventDefault();
    setSearchFor(headerQuery.trim());
    setSidebarTab(role === 'driver' ? 'explore' : role === 'worker' ? 'mylot' : 'allots');
  };

  /* notification links from the backend → dashboard tabs */
  const openLink = (link) => {
    const u = new URL(link || '/', window.location.origin);
    const id = u.searchParams.get('id');
    if (u.pathname === '/zone') { setDeepLink({ zoneId: id }); setSidebarTab('festival'); }
    else if (u.pathname === '/booking') { setDeepLink({ bookingId: id }); setSidebarTab('neighbourhood'); }
    else if (u.pathname === '/host') setSidebarTab('host');
    else if (u.hash === '#festival') setSidebarTab('festival');
    else if (u.hash === '#neighbourhood') setSidebarTab('neighbourhood');
  };

  const navItems = SIDEBAR_ITEMS[role] || SIDEBAR_ITEMS.driver;
  const lotName = (id) => lotList.find((l) => l._id === id)?.name ?? id;
  const act = activity.data;
  const res = act?.activeReservation, ses = act?.activeSession;
  const paidTotal = (act?.payments ?? []).reduce((a, p) => a + p.amountInr, 0);
  const offline = [activity.error, lots.error, overview.error].find((e) => e?.code === 'offline');

  /* ── role colours ── */
  const roleAccent =
    role === 'developer' ? 'bg-purple-50 text-purple-700 border-purple-200' :
    role === 'worker'    ? 'bg-amber-50 text-amber-700 border-amber-200'    :
                           'bg-sky-50 text-sky-700 border-sky-200';

  const roleLabel =
    role === 'developer' ? 'Dev / Admin' :
    role === 'worker'    ? 'Lot Attendant' :
                           'Citizen';

  const roleSub =
    role === 'developer' ? 'Municipal Dev Console' :
    role === 'worker'    ? 'Attendant Portal' :
                           'Citizen App';

  /* ────────────────────────────────────────────────────────────────────── */
  return (
    <div className="dashboard-enter min-h-screen bg-sky-50/60 text-slate-900 flex flex-col font-sans">

      {/* ── Toast ── */}
      {notification && (
        <div role="status" className="dashboard-panel-enter fixed top-20 right-6 z-[60] bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* ── Top Nav Bar ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-sky-100 shadow-xs">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Left: hamburger (mobile) + Brand */}
          <div className="flex items-center gap-3">
            {/* mobile sidebar toggle */}
            <button
              type="button"
              onClick={() => setSidebarOpen(o => !o)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center text-white font-black text-base shadow-xs">
                P
              </div>
              <div className="hidden sm:block">
                <span className="text-base font-extrabold text-slate-900 tracking-tight">Park'd</span>
                <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-sky-600 block -mt-1">{roleSub}</span>
              </div>
            </div>

            <div className={`hidden sm:block px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${roleAccent}`}>
              {roleLabel}
            </div>
          </div>

          {/* Center Search */}
          <form onSubmit={runHeaderSearch} className="hidden md:flex items-center flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={headerQuery}
                onChange={(e) => setHeaderQuery(e.target.value)}
                placeholder={
                  role === 'developer' ? 'Search lots or sectors…' :
                  role === 'worker'    ? 'Search slot number (e.g. P12)…' :
                                        'Search sectors (17, 22, 35) or parkings...'
                }
                className="w-full pl-9 pr-4 py-1.5 text-xs rounded-full bg-slate-100/80 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 text-slate-800 placeholder:text-slate-400 transition-all"
              />
            </div>
          </form>

          {/* Right: user + notifications + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800 leading-tight">{userName}</span>
              <span className="text-[10px] font-mono text-slate-500">
                {role === 'driver' ? (me.vehicleNo || me.email || 'No vehicle saved') : `Staff ID: ${govtPassId}`}
              </span>
            </div>
            <NotificationBell onOpenLink={openLink} showToast={showToast} />
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
              title="Log out"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: Sidebar + Main ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── SIDEBAR ─── */}
        <>
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-xs lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <aside
            className={`
              fixed lg:sticky top-16 h-[calc(100vh-4rem)] z-30
              flex flex-col w-60 shrink-0
              bg-white border-r border-sky-100 shadow-sm
              transition-transform duration-200 ease-in-out
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}
          >
            {/* User mini card */}
            <div className="px-4 py-5 border-b border-sky-50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-black text-white ${
                  role === 'developer' ? 'bg-gradient-to-br from-purple-500 to-purple-700' :
                  role === 'worker'    ? 'bg-gradient-to-br from-amber-400 to-amber-600'   :
                                        'bg-gradient-to-br from-sky-400 to-sky-600'
                }`}>
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{userName}</p>
                  <p className={`text-[10px] font-mono font-semibold uppercase tracking-wide ${
                    role === 'developer' ? 'text-purple-600' :
                    role === 'worker'    ? 'text-amber-600'  :
                                          'text-sky-600'
                  }`}>{roleLabel}</p>
                </div>
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
              {navItems.map(({ id, label, Icon }) => {
                const isActive = sidebarTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setSidebarTab(id); setSidebarOpen(false); }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer text-left
                      ${isActive
                        ? 'bg-sky-50 text-sky-700 font-semibold border-l-[3px] border-sky-500 pl-[calc(0.75rem-3px)]'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-l-[3px] border-transparent pl-[calc(0.75rem-3px)]'
                      }
                    `}
                  >
                    <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} size={18} />
                    <span>{label}</span>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-sky-400" />}
                  </button>
                );
              })}
            </nav>

            {/* Bottom: version tag */}
            <div className="px-4 py-4 border-t border-sky-50">
              <p className="text-[10px] font-mono text-slate-400 text-center">Park'd v2.0 · CHD Municipal · demo data</p>
            </div>
          </aside>
        </>

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div key={`${role}-${sidebarTab}`} className="dashboard-panel-enter space-y-8">

          {offline && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <TriangleAlert className="w-4 h-4" />
              Can't reach the Park'd server, so nothing below is live. Start the backend (npm run dev in parkchd-backend) and refresh.
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              STAT CARDS (role-specific, from the live API)
          ══════════════════════════════════════════════════════════ */}
          {sidebarTab === 'home' && role === 'developer' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <StatCard label="Total Network Capacity" value={overview.data ? `${overview.data.capacity.toLocaleString('en-IN')} Slots` : '—'} sub={overview.data ? `${overview.data.lots.total} MC lots · ${overview.data.lots.openNow} open now` : 'Loading…'} subGreen Icon={Server} />
              <StatCard label="Live Occupancy Rate"    value={overview.data ? `${overview.data.occupancyPct}%` : '—'} sub={overview.data ? `${overview.data.available} spaces free right now` : ''} Icon={Activity} />
              <StatCard label="Municipal API Health"   value={overview.error ? 'Offline' : overview.data ? 'Online' : '—'} sub="Park'd server reachable" subGreen={!overview.error} Icon={Radio} />
              <StatCard label="Revenue · last 24 h"    value={overview.data ? inr(overview.data.revenue.totalInr) : '—'} sub="Demo data: simulated payments" Icon={CreditCard} />
            </div>
          )}

          {sidebarTab === 'home' && role === 'worker' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <StatCard label="Designated Lot"        value={workerLot ? workerLot.name.replace(' Parking', '') : '—'} sub={workerLot ? `${lotList.length} lot(s) assigned · ${govtPassId}` : 'Loading…'} Icon={MapPin} />
              <StatCard label="Available Free Slots"  value={workerLot ? `${workerLot.stats.available} / ${workerLot.capacity}` : '—'} sub={workerLot ? `${workerLot.stats.reserved} held for app arrivals` : ''} subGreen Icon={Car} />
              <WorkerCollectedCard lotId={workerLotId} />
              <StatCard label="Entry Barrier Gate"    value={barrierOpen ? 'OPEN' : 'ARMED'} sub="Demo only · no gate hardware" Icon={ShieldCheck} />
            </div>
          )}

          {sidebarTab === 'home' && role === 'driver' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {res ? <StatCard label="Active 15-Min Reservation" value={`${duration(new Date(res.expiresAt) - Date.now())} left`} sub={`${lotName(res.lotId)} · Slot ${res.slotNumber}`} Icon={Clock} accent />
                : ses ? <StatCard label="Parked Right Now" value={`Slot ${ses.slotNumber}`} sub={`${lotName(ses.lotId)} · since ${time(ses.startedAt)}`} Icon={Clock} accent />
                : <StatCard label="Active 15-Min Reservation" value="None" sub="Reserve a slot from Explore" Icon={Clock} />}
              <StatCard label="Paid via Park'd"            value={inr(paidTotal)} sub={`${act?.payments?.length ?? 0} receipts · demo UPI`} Icon={Wallet} />
              <StatCard label="Total Trips Parked"        value={`${act?.sessions?.length ?? 0} Trips`} sub={`Across ${new Set((act?.sessions ?? []).map((s) => s.lotId)).size} lots`} Icon={Car} />
              <StatCard label="Neighbourhood Bookings"    value={nbBookings.data?.bookings?.length ?? 0} sub={`${(nbBookings.data?.bookings ?? []).filter((b) => b.status === 'confirmed').length} upcoming`} subGreen Icon={House} />
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB-BASED PANEL CONTENT
          ══════════════════════════════════════════════════════════ */}

          {/* ─── DRIVER PANELS ─── */}
          {role === 'driver' && (
            <>
              {sidebarTab === 'home' && (
                <DriverHome
                  activity={activity}
                  lotName={lotName}
                  lots={lotList}
                  showToast={showToast}
                  onExplore={() => setSidebarTab('explore')}
                  onFestival={() => setSidebarTab('festival')}
                />
              )}
              {sidebarTab === 'explore' && <DriverExplore showToast={showToast} lots={lotList} initialQuery={searchFor} onViewLot={setViewLotId} />}
              {sidebarTab === 'festival' && <DriverFestival onViewLot={setViewLotId} openZoneId={deepLink.zoneId} onZoneOpened={() => setDeepLink({})} />}
              {sidebarTab === 'neighbourhood' && <DriverNeighbourhood showToast={showToast} initialQuery={searchFor} openBookingId={deepLink.bookingId} onBookingOpened={() => setDeepLink({})} onHost={() => setSidebarTab('host')} />}
              {sidebarTab === 'reservations' && <DriverReservations showToast={showToast} activity={activity} lotName={lotName} lots={lotList} nbBookings={nbBookings} onOpenBooking={(id) => { setDeepLink({ bookingId: id }); setSidebarTab('neighbourhood'); }} />}
              {sidebarTab === 'mycar'        && <DriverMyCar showToast={showToast} me={me} activity={activity} lots={lotList} lotName={lotName} />}
              {sidebarTab === 'host'         && <DriverHost showToast={showToast} onOpenBooking={(id) => { setDeepLink({ bookingId: id }); setSidebarTab('neighbourhood'); }} />}
              {sidebarTab === 'profile'      && <DriverProfile userName={userName} me={me} showToast={showToast} />}
              {viewLotId && (
                <LotSlotViewer
                  lotId={viewLotId}
                  activity={activity}
                  showToast={showToast}
                  onChanged={() => { activity.reload(); lots.reload(); }}
                  onOpenLot={setViewLotId}
                  onClose={() => setViewLotId(null)}
                />
              )}
            </>
          )}

          {/* ─── WORKER PANELS ─── */}
          {role === 'worker' && (
            <>
              {sidebarTab === 'home' && <WorkerHome lots={lotList} lot={workerLot} onSelectLot={setWorkerLotId} onViewLot={() => setSidebarTab('mylot')} />}
              {sidebarTab === 'mylot' && workerLot && (
                <WorkerLotPanel
                  lot={workerLot}
                  lots={lotList}
                  onSelectLot={setWorkerLotId}
                  slotQuery={searchFor}
                  barrierOpen={barrierOpen}
                  handleToggleBarrier={handleToggleBarrier}
                  showToast={showToast}
                  onReport={() => setSidebarTab('report')}
                />
              )}
              {sidebarTab === 'queue'   && workerLot && <WorkerQueue lot={workerLot} showToast={showToast} />}
              {sidebarTab === 'report'  && workerLot && <WorkerReport lot={workerLot} showToast={showToast} />}
              {sidebarTab === 'barrier' && <WorkerBarrier lot={workerLot} barrierOpen={barrierOpen} handleToggleBarrier={handleToggleBarrier} />}
              {sidebarTab !== 'home' && sidebarTab !== 'barrier' && !workerLot && <Loading />}
            </>
          )}

          {/* ─── DEVELOPER PANELS ─── */}
          {role === 'developer' && (
            <>
              {sidebarTab === 'home' && <DevHome overview={overview} onViewAnalytics={() => setSidebarTab('analytics')} />}
              {sidebarTab === 'analytics' && <DevAnalytics showToast={showToast} overview={overview} lots={lotList} />}
              {sidebarTab === 'festival' && <AdminFestival showToast={showToast} />}
              {sidebarTab === 'neighbourhood' && <AdminNeighbourhood showToast={showToast} />}
              {sidebarTab === 'allots' && <DevAllLots showToast={showToast} lots={lots} initialQuery={searchFor} />}
              {sidebarTab === 'logs'   && <DevLogs />}
              {sidebarTab === 'users'  && <DevUsers showToast={showToast} />}
              {sidebarTab === 'api'    && <DevApiHealth showToast={showToast} />}
            </>
          )}

          </div>
        </main>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   SHARED STAT CARD
────────────────────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, Icon, subGreen, accent }) {
  return (
    <div className="p-5 rounded-2xl bg-white border border-sky-100 shadow-xs">
      <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
        <span>{label}</span>
        <Icon className="w-4 h-4 text-sky-600" />
      </div>
      <div className={`text-2xl font-black mt-2 ${accent ? 'text-sky-600' : 'text-slate-900'}`}>{value}</div>
      <div className={`text-[11px] font-medium mt-1 ${subGreen ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>{sub}</div>
    </div>
  );
}

/* Exports driver receipts (payments) as CSV */
function exportReceipts(payments, lotName) {
  downloadCsv('parkd-receipts.csv', [
    ['Date', 'Lot', 'Slot', 'Purpose', 'Method', 'Amount (INR)', 'Reference', 'Simulated'],
    ...payments.map((p) => [dateTime(p.createdAt), lotName(p.lotId), p.slotNumber, p.purpose, p.upiApp || p.method, p.amountInr, p.reference, p.simulated ? 'yes' : 'no']),
  ]);
}

/* Active reservation / parked-car actions, shared by Home and Reservations */
function ActiveParkingActions({ activity, showToast, tone = 'light' }) {
  const [busy, setBusy] = useState(null);
  const r = activity.data?.activeReservation, s = activity.data?.activeSession;
  const run = async (key, fn, msg) => { setBusy(key); try { await fn(); showToast(msg); await activity.reload(); } catch (e) { showToast(e.message); } finally { setBusy(null); } };
  const cls = tone === 'light' ? 'bg-white text-sky-800 hover:bg-sky-50' : 'bg-sky-600 text-white hover:bg-sky-500';
  const btn = `px-4 py-2 rounded-full font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 ${cls}`;
  if (r) return (
    <div className="flex flex-wrap gap-2">
      {r.status === 'pending-payment'
        ? UPI_APPS.map((a) => <button key={a} type="button" disabled={!!busy} className={btn} onClick={() => run(a, () => api('POST', `/reservations/${r._id}/pay`, { upiApp: a }), 'Paid (demo UPI). Slot held.')}>Pay {inr(r.feeInr)} · {a}</button>)
        : <button type="button" disabled={!!busy} className={btn} onClick={() => run('in', () => api('POST', `/reservations/${r._id}/check-in`), 'Checked in. Your car is saved.')}>I've arrived · check in</button>}
      <button type="button" disabled={!!busy} className={`${btn} !bg-transparent border border-current`} onClick={() => run('x', () => api('POST', `/reservations/${r._id}/cancel`), 'Reservation cancelled')}>Cancel</button>
    </div>
  );
  if (s) return (
    <div className="flex flex-wrap gap-2">
      {!s.paymentId && <button type="button" disabled={!!busy} className={btn} onClick={() => run('pay', () => api('POST', `/sessions/${s._id}/pay`, { upiApp: 'Google Pay' }), 'Paid (demo UPI)')}>Pay {inr(s.feeInr)} with UPI</button>}
      <button type="button" disabled={!!busy || !s.paymentId} className={btn} onClick={() => run('end', () => api('POST', `/sessions/${s._id}/end`), 'Slot freed. Drive safe.')}>I've left the lot</button>
    </div>
  );
  return null;
}

/* ──────────────────────────────────────────────────────────────────────────
   DRIVER: HOME / EXPLORE
────────────────────────────────────────────────────────────────────────── */
function DriverHome({ activity, lotName, lots, showToast, onExplore, onFestival }) {
  const fest = useLoad(() => api('GET', '/festival'));
  useLive({ 'festival:update': () => fest.reload() });
  const a = activity.data;
  const r = a?.activeReservation, s = a?.activeSession;
  const current = r || s;
  const lot = current ? lots.find((l) => l._id === current.lotId) : null;
  const payments = a?.payments ?? [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-8 space-y-6">
        <ErrorNote error={activity.error?.code === 'offline' ? null : activity.error} onRetry={activity.reload} />
        {current && (
          <div className="p-6 rounded-3xl bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-[11px] font-mono font-bold mb-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>{r ? (r.status === 'held' ? 'SPOT GUARANTEED & LOCKED' : 'PAY TO LOCK YOUR SPOT') : 'YOUR CAR IS PARKED'}</span>
                </div>
                <h3 className="text-xl font-black">{lotName(current.lotId)}</h3>
                <p className="text-xs text-sky-100 mt-0.5 font-medium">
                  Slot {current.slotNumber} · Flat Fee: {inr(current.feeInr)}
                  {r ? ` · hold ends in ${duration(new Date(r.expiresAt) - Date.now())}` : ` · parked ${duration(Date.now() - new Date(s.startedAt))}`}
                </p>
              </div>
              {lot && (
                <a
                  href={directionsUrl(lot.lat, lot.lng, s ? 'walking' : 'driving')}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 rounded-full bg-white text-sky-800 font-bold text-xs shadow-md hover:bg-sky-50 transition-all flex items-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{s ? 'Walk back to car' : 'Navigate in Maps'}</span>
                </a>
              )}
            </div>
            <div className="mt-4"><ActiveParkingActions activity={activity} showToast={showToast} /></div>
          </div>
        )}

        {fest.data?.active && fest.data.activeZoneCount > 0 && (
          <button type="button" onClick={onFestival} className="w-full text-left p-5 rounded-3xl bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 shadow-md flex items-center gap-4">
            <PartyPopper className="w-8 h-8 shrink-0" />
            <div className="flex-1"><p className="text-sm font-black">{fest.data.label || 'Festival Mode: extra parking open'}</p><p className="text-xs font-medium">{fest.data.activeZoneCount} temporary zone(s) · {fest.data.extraFree} extra spaces free</p></div>
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Your parking at a glance</h3>
              <p className="mt-1 text-xs text-slate-500">A quick summary of your recent activity.</p>
            </div>
            <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">All time</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-slate-900">{a?.sessions?.length ?? 0}</p><p className="text-[10px] text-slate-500">trips</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-slate-900">{inr(payments.reduce((x, p) => x + p.amountInr, 0))}</p><p className="text-[10px] text-slate-500">paid (demo)</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-slate-900">{a?.reservations?.length ?? 0}</p><p className="text-[10px] text-slate-500">reservations</p></div>
          </div>
          <button type="button" onClick={onExplore} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-sky-700 hover:text-sky-800">
            Explore nearby parking <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right: parking history */}
      <div className="lg:col-span-4 space-y-6">
        <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">Recent Parking History</h3>
          <div className="divide-y divide-slate-100 mt-2 text-xs">
            {activity.loading && !a ? <Loading /> : payments.length === 0 ? <p className="py-4 text-slate-500">No payments yet. Reserve or check in from Explore.</p> : payments.slice(0, 5).map((h) => (
              <div key={h._id} className="py-3">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>{lotName(h.lotId)}</span>
                  <span className="text-sky-600">{inr(h.amountInr)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-0.5">
                  <span>{dateTime(h.createdAt)}</span>
                  <span>{h.reference}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={!payments.length}
              onClick={() => { exportReceipts(payments, lotName); showToast('Receipts downloaded (CSV)'); }}
              className="w-full py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all cursor-pointer shadow-xs disabled:opacity-40"
            >
              Download Receipts (CSV)
            </button>
            <p className="mt-2 text-[10px] font-mono text-slate-400 text-center">Payments are simulated in this demo — no money moves.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Slot-grid viewer (same look as the landing page InteractiveLotDemo), now live ── */
function LotSlotViewer({ lotId, activity, showToast, onChanged, onOpenLot, onClose }) {
  const d = useLoad(() => api('GET', `/lots/${encodeURIComponent(lotId)}`), [lotId]);
  const [selectedSlot, setSelectedSlot] = React.useState(null);
  const [pending, setPending] = React.useState(null); // reservation awaiting payment
  const [confirmed, setConfirmed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const alts = useLoad(() => api('GET', `/lots/${encodeURIComponent(lotId)}/alternatives`), [lotId]);
  useLive({ 'slot:update': (u) => { if (u.lotId === lotId) d.setData((x) => (x ? { ...x, slots: x.slots.map((s) => (s._id === u._id ? { ...s, ...u } : s)) } : x)); },
    'lot:update': (s) => { if (s.lotId === lotId) d.setData((x) => (x ? { ...x, lot: { ...x.lot, stats: s } } : x)); } });

  const lot = d.data?.lot;
  const slots = d.data?.slots ?? [];
  const freeSlots     = slots.filter(s => s.state === 'available').length;
  const occupiedSlots = slots.filter(s => s.state === 'occupied').length;
  const reservedSlots = slots.filter(s => s.state === 'reserved').length;
  const pctFull       = lot ? lot.stats.occupancyPct : 0;
  const busyDriver    = activity.data?.activeReservation || activity.data?.activeSession;
  const open          = lot?.stats?.open;

  const handleSlotTap = (slot) => {
    if (slot.state === 'available' && slot.kind === 'reservable') setSelectedSlot(slot._id === selectedSlot ? null : slot._id);
    else if (slot.state === 'available') showToast('Walk-in slot: just drive in, or tap "I\'m here · check in". Only R slots can be reserved.');
  };
  const run = async (fn) => { setBusy(true); setErr(null); try { return await fn(); } catch (e) { setErr(e); d.reload(); return null; } finally { setBusy(false); } };

  const handleConfirm = () => run(async () => {
    const { reservation } = await api('POST', '/reservations', { lotId, slotId: selectedSlot });
    setPending(reservation); setSelectedSlot(null); onChanged();
  });
  const handlePay = (app) => run(async () => {
    await api('POST', `/reservations/${pending._id}/pay`, { upiApp: app });
    setConfirmed(true); setPending(null); onChanged();
    showToast(`Slot ${pending.slotNumber} confirmed at ${lot.name} · 15-min lock active`);
  });
  const handleWalkIn = () => run(async () => {
    const { session } = await api('POST', `/lots/${encodeURIComponent(lotId)}/check-in`, {});
    showToast(`Checked in at slot ${session.slotNumber}. Pay ${inr(session.feeInr)} from Reservations.`); onChanged(); onClose();
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="dashboard-panel-enter w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-600">Live Slot View</span>
              {lot?.kind === 'temporary' && <Pill tone="yellow">TEMPORARY ZONE</Pill>}
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5 flex items-center gap-2">
              {lot?.name ?? 'Loading…'}
              {lot && <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                pctFull >= 85 ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {pctFull}% Full
              </span>}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{open ? `Tap a green "R" slot to reserve for 15 minutes (${inr(lot?.feeInr)})` : lot ? 'This lot is closed right now.' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => d.reload()} className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 transition-colors" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-600 transition-colors text-sm font-bold" title="Close">
              ✕
            </button>
          </div>
        </div>

        {d.loading && !lot && <Loading />}
        <div className="px-6"><ErrorNote error={d.error} onRetry={d.reload} /></div>

        {/* Alternatives when the lot is (nearly) full */}
        {lot && open && pctFull >= 85 && (alts.data?.suggestions ?? []).length > 0 && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
            <p className="font-bold text-amber-900">This lot is {pctFull}% full. Try one of these instead:</p>
            <div className="mt-2 space-y-1">
              {alts.data.suggestions.map((x) => (
                <button key={x._id} type="button" onClick={() => onOpenLot(x._id)} className="w-full flex items-center justify-between gap-2 text-left hover:underline">
                  <span className="font-semibold text-slate-800">{x.name} {x.kind === 'temporary' && <Pill tone="yellow">TEMPORARY</Pill>}</span>
                  <span className="text-slate-600">{x.stats.available} free · {x.distanceKm} km</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-amber-800/70">{alts.data.note}</p>
          </div>
        )}

        {/* Slot grid */}
        <div className="px-6 pt-4 pb-2">
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
            {slots.map((slot) => {
              const isSelected = selectedSlot === slot._id;
              const isFree     = slot.state === 'available';
              const isOccupied = slot.state === 'occupied';
              const isReserved = slot.state === 'reserved';
              const canReserve = isFree && slot.kind === 'reservable';
              return (
                <button
                  key={slot._id}
                  type="button"
                  onClick={() => handleSlotTap(slot)}
                  disabled={!isFree}
                  title={canReserve ? 'Reservable slot' : isFree ? 'Walk-in slot' : slot.state}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-150 border text-center relative
                    ${isSelected ? 'ring-2 ring-sky-500 scale-105 z-10 shadow-md' : ''}
                    ${isFree     ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800 cursor-pointer' : ''}
                    ${isOccupied ? 'bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed' : ''}
                    ${isReserved ? 'bg-amber-50 border-amber-300 text-amber-800 cursor-not-allowed' : ''}
                  `}
                >
                  {slot.kind === 'reservable' && <span className="absolute top-0.5 right-1 text-[8px] font-black text-sky-600">R</span>}
                  <span className="text-[9px] font-mono font-bold leading-none">{slot.number}</span>
                  <div className="mt-0.5">
                    {isFree     && <span className="text-[8px] font-bold uppercase text-emerald-700">FREE</span>}
                    {isOccupied && <Car className="w-2.5 h-2.5 text-slate-400" />}
                    {isReserved && <Clock className="w-2.5 h-2.5 text-amber-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend + confirm */}
        <div className="px-6 pb-5 pt-3 border-t border-slate-100 mt-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Free ({freeSlots})</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" />Occupied ({occupiedSlots})</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />Reserved ({reservedSlots})</span>
              <span className="text-sky-700 font-bold">R = reservable (10%)</span>
            </div>
            <span className="text-[11px] font-mono text-sky-700 font-bold">Standard {inr(lot?.feeInr ?? 14)} municipal fee</span>
          </div>

          <ErrorNote error={err} />
          {busyDriver && !pending && !confirmed && (
            <p className="mb-3 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-800 font-semibold">You already have an active reservation or parked car. Finish it in Reservations first.</p>
          )}

          {/* Confirm bar */}
          {confirmed ? (
            <div className="w-full py-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center gap-2 text-emerald-800 text-sm font-bold">
              <Check className="w-4 h-4 text-emerald-600" />
              Slot confirmed! 15-min lock active · {inr(lot?.feeInr)} (demo UPI)
            </div>
          ) : pending ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
              <p className="text-xs text-amber-900 font-semibold">Slot {pending.slotNumber} held. Pay {inr(pending.feeInr)} to lock it (demo UPI — nothing is charged):</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{UPI_APPS.map((a) => <Btn key={a} tone="ghost" busy={busy} onClick={() => handlePay(a)}>{a}</Btn>)}</div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex-1 text-xs text-slate-500">
                Selected slot:{' '}
                <span className="font-bold text-slate-900 font-mono">
                  {selectedSlot ? slots.find((s) => s._id === selectedSlot)?.number : 'Tap a green R slot above'}
                </span>
              </div>
              <button
                type="button"
                disabled={!open || !!busyDriver || busy}
                onClick={handleWalkIn}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border-2 border-slate-200 hover:border-sky-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                I'm here · check in
              </button>
              <button
                type="button"
                disabled={!selectedSlot || !!busyDriver || busy}
                onClick={handleConfirm}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  selectedSlot && !busyDriver
                    ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Confirm slot · {inr(lot?.feeInr ?? 14)}
                <Navigation className="w-3 h-3" />
              </button>
            </div>
          )}
          {lot && <a href={directionsUrl(lot.lat, lot.lng)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-700"><Navigation className="w-3 h-3" />Directions to {lot.name}</a>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DriverExplore({ showToast, lots, initialQuery, onViewLot }) {
  const [searchQuery, setSearchQuery] = React.useState(initialQuery || '');
  const [result, setResult] = React.useState(null); // server search result { place, lots }
  const [selected, setSelected] = React.useState(null);
  const [me, setMe] = React.useState(null);

  // Server-side search ("sec 22", "elante", "pgi"): debounced; empty query shows every lot.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setResult(null); return undefined; }
    const t = setTimeout(() => api('GET', `/search?q=${encodeURIComponent(q)}`).then(setResult).catch(() => setResult(null)), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const live = (l) => lots.find((x) => x._id === l._id) ?? l; // keep live stats on search results
  const filteredLots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (result?.place) return result.lots.map((l) => ({ ...live(l), distanceKm: l.distanceKm }));
    if (q) return lots.filter((lot) => `${lot.name} ${lot.sector} ${lot.address}`.toLowerCase().includes(q));
    if (me) return [...lots].map((l) => ({ ...l, distanceKm: Math.round(Math.hypot((l.lat - me.lat) * 111, (l.lng - me.lng) * 95.5) * 10) / 10 })).sort((a, b) => a.distanceKm - b.distanceKm);
    return lots;
  }, [lots, result, searchQuery, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const origin = result?.place?.lat ? { lat: result.place.lat, lng: result.place.lng } : me;
  const selectedLot = filteredLots.find((l) => l._id === selected);
  const markers = filteredLots.map((l) => {
    const lv = level(l.stats);
    return { id: l._id, lat: l.lat, lng: l.lng, text: l.stats.open ? (l.kind === 'temporary' ? `+${l.stats.available}` : l.stats.available) : '—', tone: l.kind === 'temporary' ? 'temp' : lv.key, title: l.name };
  });

  const locate = () => {
    if (!navigator.geolocation) { showToast('Location is not available in this browser.'); return; }
    navigator.geolocation.getCurrentPosition((p) => {
      const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
      setMe(loc); setSearchQuery('');
      api('GET', `/lots?lat=${loc.lat}&lng=${loc.lng}`).catch(() => {}); // lets Festival Mode alert you about nearby zones
      showToast('Sorted by distance from you');
    }, () => showToast('Location permission denied. Search a sector instead.'), { timeout: 8000 });
  };

  const openDirections = (lot) => {
    window.open(directionsUrl(lot.lat, lot.lng), '_blank', 'noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Parking near you</h2>
          <p className="text-sm text-slate-500 mt-0.5">{result?.place ? `Near ${result.place.label}: ${result.totalAvailable} spaces free.` : 'Live availability from attendants, updated as cars come and go.'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={locate} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-700 hover:text-sky-800 px-3 py-1.5 rounded-full bg-sky-50 hover:bg-sky-100"><LocateFixed className="w-3 h-3" />Near me</button>
          <span className="text-xs text-slate-500 font-medium">{filteredLots.length} locations</span>
        </div>
      </div>

      {/* Search */}
      <label className="relative block">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by lot name, sector, or landmark — e.g. Sector 17, Sukhna, Elante, PGI"
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
        />
      </label>

      {/* Live map (Leaflet + OpenStreetMap) */}
      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-xs">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Live map · Chandigarh</h3>
            <p className="text-xs text-slate-500">Green: plenty · amber: limited · red: full · yellow square: Festival zone · grey: closed</p>
          </div>
          <a
            href={selectedLot ? directionsUrl(selectedLot.lat, selectedLot.lng) : 'https://www.google.com/maps/search/parking+chandigarh/@30.7333,76.7794,13z'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-700 hover:text-sky-800 px-3 py-1.5 rounded-full bg-sky-50 hover:bg-sky-100 transition-all"
          >
            <MapPin className="h-3 w-3" /> Open in Maps
          </a>
        </div>
        <LiveMap
          markers={markers}
          selectedId={selected}
          onSelect={setSelected}
          me={me}
          route={selectedLot && origin ? { from: origin, to: selectedLot } : null}
        />
        {selectedLot && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-slate-100 text-xs">
            <span className="font-bold text-slate-900">{selectedLot.name}</span>
            <span className="text-slate-500">{selectedLot.stats.open ? `${selectedLot.stats.available} free` : 'Closed'}{selectedLot.distanceKm != null ? ` · ${selectedLot.distanceKm} km` : ''}</span>
            <Btn className="ml-auto !py-1.5" onClick={() => onViewLot(selectedLot._id)}>View parking</Btn>
          </div>
        )}
      </section>

      {/* Card grid */}
      {filteredLots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          {lots.length ? 'No parking lots match that search.' : 'Loading parking lots…'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLots.map((lot) => {
            const s = lot.stats;
            const pctFull  = s.occupancyPct;
            const avail    = level(s);
            const temp     = lot.kind === 'temporary';

            return (
              <article
                key={lot._id}
                className={`rounded-2xl border-2 ${temp ? 'border-amber-200 bg-gradient-to-b from-amber-50 to-white' : 'border-slate-200 bg-white'} hover:border-sky-200 hover:shadow-sm p-5 transition-all`}
              >
                {/* Name + free count */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {temp && <Pill tone="yellow" className="mb-1">TEMPORARY · FESTIVAL</Pill>}
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{lot.name}</h4>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xl font-black text-slate-900">{s.available}</span>
                    <span className="text-xs text-slate-400">/{lot.capacity}</span>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">SLOTS FREE</p>
                  </div>
                </div>

                {/* Address */}
                <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                  {sectorLabel(lot.sector)} · {lot.address}
                </p>

                {/* Badges */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${avail.bg} ${avail.color}`}>
                    {s.available} free · {avail.text}
                  </span>
                  <span className="text-[11px] text-slate-500">{pctFull}% full</span>
                  <span className="text-[11px] text-slate-500">{inr(lot.feeInr)}/entry</span>
                </div>

                {/* Status row */}
                <div className="mt-2 flex items-center gap-3 text-[11px]">
                  {s.open
                    ? <span className="flex items-center gap-1 font-semibold text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Open</span>
                    : <span className="flex items-center gap-1 font-semibold text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Closed now</span>}
                  <span className="text-slate-500">🗓 {s.reservableFree} reservable</span>
                  <span className="text-slate-400 ml-auto">{lot.opensAt === 0 && lot.closesAt === 24 ? 'Open 24 h' : `${lot.opensAt}:00–${lot.closesAt}:00`}{lot.distanceKm != null ? ` · ${lot.distanceKm} km` : ''}</span>
                </div>

                {/* Availability bar */}
                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctFull}%`, backgroundColor: avail.bar }} />
                </div>

                {/* Buttons */}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onViewLot(lot._id)}
                    className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all"
                  >
                    View parking
                  </button>
                  <button
                    type="button"
                    onClick={() => openDirections(lot)}
                    className="flex-1 py-2 rounded-xl border-2 border-slate-200 hover:border-sky-300 text-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Navigation className="w-3.5 h-3.5 text-sky-500" />
                    Directions
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

const RES_STATUS = { 'pending-payment': 'Awaiting payment', held: 'Held', 'checked-in': 'Used', expired: 'Expired', cancelled: 'Cancelled' };
function DriverReservations({ showToast, activity, lotName, nbBookings, onOpenBooking }) {
  const a = activity.data;
  const r = a?.activeReservation, s = a?.activeSession;
  const history = (a?.reservations ?? []).filter((x) => x._id !== r?._id);
  return (
    <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs max-w-3xl">
      <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">My Reservations</h3>
      <div className="space-y-4 mt-4">
        {activity.loading && !a && <Loading />}
        {(r || s) && (
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-sky-700 uppercase font-mono">{r ? (r.status === 'held' ? 'Active Lock' : 'Awaiting payment') : 'Parked now'}</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{lotName((r || s).lotId)}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Slot {(r || s).slotNumber} · {r ? `${duration(new Date(r.expiresAt) - Date.now())} remaining` : `since ${time(s.startedAt)}${s.paymentId ? ' · fee paid' : ` · ${inr(s.feeInr)} due`}`}</p>
              </div>
              <span className="px-3 py-1.5 rounded-full bg-sky-600 text-white text-[10px] font-mono font-bold">LIVE</span>
            </div>
            <ActiveParkingActions activity={activity} showToast={showToast} tone="dark" />
          </div>
        )}
        {!r && !s && a && <p className="text-xs text-slate-500">No active reservation. Reserve one of the 10% bookable slots from Explore.</p>}
        {history.map((x) => (
          <div key={x._id} className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800">{lotName(x.lotId)}</p>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">{dateTime(x.createdAt)} · Slot {x.slotNumber} · {x._id}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-sky-600">{inr(x.feeInr)}</p>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${x.status === 'checked-in' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{RES_STATUS[x.status] ?? x.status}</span>
            </div>
          </div>
        ))}
        {(nbBookings.data?.bookings ?? []).length > 0 && (
          <>
            <p className="pt-2 text-xs font-bold text-slate-900">Neighbourhood bookings</p>
            {nbBookings.data.bookings.slice(0, 6).map((b) => (
              <button key={b._id} type="button" onClick={() => onOpenBooking(b._id)} className="w-full text-left p-4 rounded-2xl border border-blue-100 flex items-center justify-between hover:border-blue-300">
                <div><p className="text-sm font-bold text-slate-800">{b.title}</p><p className="text-[11px] text-slate-500 font-mono mt-0.5">{dateTime(b.start)} · {b.hours} h · {b._id}</p></div>
                <div className="text-right"><p className="text-sm font-bold text-sky-600">{inr(b.totalInr)}</p><span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{b.status}</span></div>
              </button>
            ))}
          </>
        )}
        <button
          type="button"
          disabled={!a?.payments?.length}
          onClick={() => { exportReceipts(a.payments, lotName); showToast('History downloaded (CSV)'); }}
          className="w-full py-2.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all cursor-pointer shadow-xs mt-2 disabled:opacity-40"
        >
          Export Full History (CSV)
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   DRIVER: MY CAR
────────────────────────────────────────────────────────────────────────── */
function DriverMyCar({ showToast, me, activity, lots, lotName }) {
  const [vehicleNo, setVehicleNo] = useState(me.vehicleNo || '');
  const [saving, setSaving] = useState(false);
  const s = activity.data?.activeSession;
  const lot = s ? lots.find((l) => l._id === s.lotId) : null;
  const save = async () => {
    setSaving(true);
    try { const { user } = await api('PATCH', '/me', { vehicleNo }); me.vehicleNo = user.vehicleNo; showToast('Vehicle saved'); } catch (e) { showToast(e.message); } finally { setSaving(false); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-3xl">
      <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Find My Car</h3>
        {s ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-4xl font-black text-sky-600">{s.slotNumber}</p>
            <p className="text-xs text-slate-600">{lotName(s.lotId)} · parked at {time(s.startedAt)} ({duration(Date.now() - new Date(s.startedAt))})</p>
            {lot && <a href={directionsUrl(lot.lat, lot.lng, 'walking')} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-sky-600 text-white text-xs font-bold"><Navigation className="w-3.5 h-3.5" />Walk back to the lot</a>}
          </div>
        ) : <p className="mt-4 text-xs text-slate-500">No car parked right now. When you check in, your slot number appears here.</p>}
        <h3 className="mt-6 text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">Registered Vehicle</h3>
        <div className="mt-3 flex gap-2">
          <input className={inputCls} value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="CH01 AB 1234" aria-label="Registration number" />
          <Btn busy={saving} onClick={save}>Save</Btn>
        </div>
      </div>
      <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Quick Actions</h3>
        <div className="mt-4 space-y-2">
          {[
            ['Download Parking Receipts', () => { const p = activity.data?.payments ?? []; if (!p.length) { showToast('No receipts yet'); return; } exportReceipts(p, lotName); showToast('Receipts downloaded (CSV)'); }],
            ['View FASTag Statement', () => showToast('FASTag is not connected in this demo')],
            ['Report a Parking Violation', () => showToast('Violation reporting — coming soon')],
            ['Update Emergency Contact', () => showToast('Emergency contact — coming soon')]
          ].map(([action, fn]) => (
            <button
              key={action}
              type="button"
              onClick={fn}
              className="w-full text-left px-4 py-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold border border-sky-100 transition-all cursor-pointer flex items-center justify-between"
            >
              <span>{action}</span>
              <ChevronRight className="w-3.5 h-3.5 text-sky-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   DRIVER: PROFILE
────────────────────────────────────────────────────────────────────────── */
function DriverProfile({ userName, me, showToast }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(userName);
  const [prefs, setPrefs] = useState(me.notificationPrefs ?? { festivalAlerts: true, bookingAlerts: true });
  const save = async () => {
    try { const { user } = await api('PATCH', '/me', { name }); me.name = user.name; setEditing(false); showToast('Profile updated'); } catch (e) { showToast(e.message); }
  };
  const togglePref = async (k) => {
    const v = !prefs[k];
    try { await api('PATCH', '/me/notification-prefs', { [k]: v }); setPrefs((p) => ({ ...p, [k]: v })); showToast(v ? 'Alerts on' : 'Alerts off'); } catch (e) { showToast(e.message); }
  };
  return (
    <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs max-w-lg">
      <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-2xl font-black text-white">
          {(me.name || userName).charAt(0)}
        </div>
        <div>
          <p className="text-base font-bold text-slate-900">{userName}</p>
          <p className="text-xs font-mono text-sky-600">Citizen · Park'd</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Chandigarh Municipal Corporation</p>
        </div>
      </div>
      <div className="mt-5 space-y-3 text-sm">
        {[
          ['Mobile',       me.phone ? `+91 ${me.phone}` : 'Not added'],
          ['Email',        me.email || 'Not added'],
          ['Vehicle',      me.vehicleNo || 'Not added'],
          ['Host',         me.isHost ? 'Yes — Neighbourhood Parking' : 'No']
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-slate-500 text-xs">{k}</span>
            <span className="font-semibold text-slate-800 text-xs">{v}</span>
          </div>
        ))}
        {[['festivalAlerts', 'Festival parking alerts'], ['bookingAlerts', 'Booking updates']].map(([k, label]) => (
          <label key={k} className="flex justify-between items-center cursor-pointer">
            <span className="text-slate-500 text-xs">{label}</span>
            <input type="checkbox" className="accent-sky-600 w-4 h-4" checked={prefs[k] !== false} onChange={() => togglePref(k)} />
          </label>
        ))}
      </div>
      {editing ? (
        <div className="mt-6 flex gap-2">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
          <Btn onClick={save}>Save</Btn>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-6 w-full py-2.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer"
        >
          Edit Profile
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   WORKER: LOT PANEL (Home / My Lot)
────────────────────────────────────────────────────────────────────────── */
function useTransactions(lotId) {
  const t = useLoad(() => (lotId ? api('GET', `/attendant/lots/${encodeURIComponent(lotId)}/transactions`) : Promise.resolve(null)), [lotId]);
  useLive({ 'lot:update': (s) => { if (s.lotId === lotId) { clearTimeout(window.__pkTx); window.__pkTx = setTimeout(t.reload, 800); } } });
  return t;
}
function WorkerCollectedCard({ lotId }) {
  const t = useTransactions(lotId);
  return <StatCard label="Payments · last 24 h" value={t.data ? `${t.data.count} Cars` : '—'} sub={t.data ? `${inr(t.data.collectedInr)} collected (UPI + cash)` : ''} subGreen Icon={Clock} />;
}

function LotPicker({ lots, lot, onSelectLot }) {
  if (lots.length < 2) return null;
  return (
    <select value={lot?._id ?? ''} onChange={(e) => onSelectLot(e.target.value)} className="px-3 py-2 rounded-full bg-white border border-amber-200 text-xs font-semibold text-slate-800">
      {lots.map((l) => <option key={l._id} value={l._id}>{l.kind === 'temporary' ? `🎉 ${l.name} · temporary, ${l.zone?.status === 'active' ? 'ACTIVE' : 'not active'}` : l.name}</option>)}
    </select>
  );
}

function WorkerHome({ lots, lot, onSelectLot, onViewLot }) {
  const t = useTransactions(lot?._id);
  if (!lot) return <Loading />;
  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Shift overview</h2>
        <p className="mt-1 text-sm text-slate-500">A quick view of the last 24 hours at {lot.name}.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Payments recorded', value: t.data?.count ?? '—', note: 'Cars paid in the last 24 h' },
          { label: 'Current occupancy', value: `${lot.stats.occupied + lot.stats.reserved} / ${lot.capacity}`, note: `${lot.stats.reserved} spots held for app arrivals` },
          { label: 'Collections', value: t.data ? inr(t.data.collectedInr) : '—', note: 'UPI and cash (simulated)' }
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-xs font-medium text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="mt-1 text-[11px] text-slate-500">{stat.note}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Your assigned lot{lots.length > 1 ? 's' : ''}</p>
          <p className="mt-1 text-xs text-slate-500">{lot.name} · {lot.address}</p>
          <div className="mt-2"><LotPicker lots={lots} lot={lot} onSelectLot={onSelectLot} /></div>
        </div>
        <button type="button" onClick={onViewLot} className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-amber-600">
          Open lot controls <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function WorkerLotPanel({ lot, lots, onSelectLot, slotQuery, barrierOpen, handleToggleBarrier, showToast, onReport }) {
  const d = useLoad(() => api('GET', `/lots/${encodeURIComponent(lot._id)}`), [lot._id]);
  const t = useTransactions(lot._id);
  const [openSlot, setOpenSlot] = useState(null);
  const [q, setQ] = useState(slotQuery || '');
  useLive({ 'slot:update': (u) => { if (u.lotId === lot._id) d.setData((x) => (x ? { ...x, slots: x.slots.map((s) => (s._id === u._id ? { ...s, ...u } : s)) } : x)); } });
  const slots = (d.data?.slots ?? []).filter((s) => !q || s.number.toLowerCase().includes(q.trim().toLowerCase()));
  const closedZone = lot.kind === 'temporary' && lot.zone?.status !== 'active';
  const quick = async (method) => {
    try { const r = await api('POST', `/attendant/lots/${encodeURIComponent(lot._id)}/entry`, { method, upiApp: method === 'upi' ? 'Google Pay' : undefined }); showToast(`${r.slot.number} assigned · fee recorded (${method.toUpperCase()})`); }
    catch (e) { showToast(e.message); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-8 space-y-6">
        {lot.kind === 'temporary' && (
          <div className={`p-4 rounded-2xl text-xs font-semibold border ${closedZone ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
            <Pill tone="yellow">TEMPORARY ZONE</Pill>{' '}
            {closedZone ? "Not active: you can't register entries until the MC opens this zone. Parked cars can still exit." : `Open for Festival Mode. Gates: ${(lot.zone?.entryPoints ?? []).join(' · ') || '—'}. ${lot.zone?.restrictions ?? ''}`}
          </div>
        )}
        <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">{lot.name} Live Spot Layout ({d.data?.slots?.[0]?.number ?? 'P01'}–{d.data?.slots?.at(-1)?.number ?? ''})</h3>
              <p className="text-xs text-slate-500">Tap any slot to register an entry, record a payment, free it, or fix a mistake.</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <LotPicker lots={lots} lot={lot} onSelectLot={onSelectLot} />
              <button
                type="button"
                onClick={handleToggleBarrier}
                className={`px-4 py-2 rounded-full text-xs font-bold shadow-sm transition-all cursor-pointer ${
                  barrierOpen ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
                title="Demo only: no gate hardware is connected"
              >
                {barrierOpen ? 'Close Barrier Gate' : 'Open Barrier Gate'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-600 my-4">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /><span>Free ({lot.stats.available})</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-500"    /><span>Occupied ({lot.stats.occupied})</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-500"     /><span>App Lock ({lot.stats.reserved})</span></div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find slot…" className="ml-auto px-3 py-1 rounded-full border border-slate-200 text-xs w-28" aria-label="Find slot" />
          </div>

          {d.loading && !d.data ? <Loading /> : (
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2.5 pt-2">
              {slots.map(slot => {
                const isAvail = slot.state === 'available';
                const isOcc   = slot.state === 'occupied';
                return (
                  <button
                    key={slot._id}
                    type="button"
                    onClick={() => setOpenSlot(slot._id)}
                    className={`relative h-14 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-xs transition-all cursor-pointer border ${
                      isAvail ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 hover:scale-105' :
                      isOcc   ? 'bg-rose-50 border-rose-200 text-rose-800' :
                                'bg-sky-50 border-sky-300 text-sky-800 ring-2 ring-sky-300 animate-pulse'
                    }`}
                  >
                    {slot.kind === 'reservable' && <span className="absolute top-0.5 right-1 text-[8px] text-sky-600">R</span>}
                    <span className="text-[10px] opacity-60">{slot.number}</span>
                    <Car className="w-4 h-4 mt-0.5" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-4 space-y-6">
        <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">Recent Payments at {lot.name.replace(' Parking', '')}</h3>
          <div className="divide-y divide-slate-100 mt-2 text-xs max-h-80 overflow-y-auto">
            {(t.data?.payments ?? []).slice(0, 12).map((p) => (
              <div key={p._id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-mono font-bold text-slate-900">{p.slotNumber}</div>
                  <div className="text-[11px] text-slate-500">{p.purpose} · {time(p.createdAt)}</div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-50 text-sky-700 font-bold">{p.method === 'cash' ? 'Cash' : p.upiApp || 'UPI'} · {inr(p.amountInr)}</span>
              </div>
            ))}
            {t.data && !t.data.payments.length && <p className="py-4 text-slate-500">No payments in the last 24 h.</p>}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
            <button
              type="button"
              disabled={closedZone}
              onClick={() => quick('cash')}
              className="w-full py-2.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all cursor-pointer shadow-sm disabled:opacity-40"
            >
              + New Car · {inr(lot.feeInr)} Cash
            </button>
            <button
              type="button"
              disabled={closedZone}
              onClick={() => quick('upi')}
              className="w-full py-2.5 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-100 font-bold text-xs transition-all cursor-pointer disabled:opacity-40"
            >
              + New Car · {inr(lot.feeInr)} UPI
            </button>
            <button
              type="button"
              onClick={onReport}
              className="w-full py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
            >
              Generate Shift Summary
            </button>
          </div>
        </div>
      </div>
      {openSlot && <SlotActions slotId={openSlot} lot={lot} onClose={() => setOpenSlot(null)} showToast={showToast} />}
    </div>
  );
}

/* attendant actions on one slot */
function SlotActions({ slotId, lot, onClose, showToast }) {
  const d = useLoad(() => api('GET', `/attendant/slots/${encodeURIComponent(slotId)}`), [slotId]);
  const [veh, setVeh] = useState('');
  const [method, setMethod] = useState('cash');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const enc = encodeURIComponent(slotId);
  const run = async (fn, msg, close = true) => { setBusy(true); setErr(null); try { await fn(); showToast(msg); if (close) onClose(); else d.reload(); } catch (e) { setErr(e); } finally { setBusy(false); } };
  const { slot, session, reservation } = d.data ?? {};
  return (
    <Modal title={slot ? `Slot ${slot.number}` : 'Slot'} sub={slot ? `${slot.kind === 'reservable' ? 'Reservation pool' : 'Walk-in slot'} · ${slot.state}` : ''} onClose={onClose}>
      {d.loading && !slot ? <Loading /> : <ErrorNote error={d.error} />}
      {slot?.state === 'available' && (
        <div className="space-y-3">
          <Field label="Vehicle number (optional)"><input className={inputCls} value={veh} onChange={(e) => setVeh(e.target.value)} placeholder="CH01 AB 1234" /></Field>
          <Field label={`Fee ${inr(lot.feeInr)}`}><select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">Cash paid</option><option value="upi">UPI paid</option><option value="">Collect later</option></select></Field>
          {slot.kind === 'reservable' && <p className="text-[11px] text-slate-500">This is a reservation-pool slot. Use it for walk-ins only if the lot is otherwise full.</p>}
          <Btn className="w-full" busy={busy} onClick={() => run(() => api('POST', `/attendant/lots/${encodeURIComponent(lot._id)}/entry`, { slotId, vehicleNo: veh || undefined, method: method || undefined, upiApp: method === 'upi' ? 'Google Pay' : undefined }), `${slot.number} occupied`)}>Register entry</Btn>
        </div>
      )}
      {slot?.state === 'occupied' && (
        <div className="space-y-3 text-xs">
          {[['Vehicle', session?.vehicleNo || 'Not recorded'], ['Since', session ? `${time(session.startedAt)} · ${duration(Date.now() - new Date(session.startedAt))}` : '—'], ['Fee', session?.paymentId ? 'Paid' : `${inr(session?.feeInr)} due`], ['Source', session?.source || '—']]
            .map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-bold text-slate-800">{v}</span></div>)}
          {session && !session.paymentId && <div className="flex gap-2"><Btn tone="ghost" busy={busy} onClick={() => run(() => api('POST', `/attendant/slots/${enc}/payment`, { method: 'cash' }), 'Cash recorded', false)}>Cash paid</Btn><Btn tone="ghost" busy={busy} onClick={() => run(() => api('POST', `/attendant/slots/${enc}/payment`, { method: 'upi', upiApp: 'Google Pay' }), 'UPI recorded', false)}>UPI paid</Btn></div>}
          <Btn className="w-full" disabled={session && !session.paymentId} busy={busy} onClick={() => run(() => api('POST', `/attendant/slots/${enc}/exit`), `${slot.number} is free`)}>Car exited · free slot</Btn>
          <details className="p-3 rounded-xl border border-amber-200"><summary className="font-bold text-amber-700 cursor-pointer">Assigned by mistake?</summary>
            <div className="mt-2 space-y-2"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (saved to the audit log)" /><Btn tone="danger" busy={busy} onClick={() => run(() => api('POST', `/attendant/slots/${enc}/correct`, { reason }), `${slot.number} corrected`)}>Void &amp; free slot</Btn></div>
          </details>
        </div>
      )}
      {slot?.state === 'reserved' && (
        <div className="space-y-3 text-xs">
          {[['Booking', reservation?._id || '—'], ['Status', reservation?.status === 'held' ? 'Paid, on hold' : 'Awaiting payment'], ['Hold ends', reservation ? `${time(reservation.expiresAt)} (${duration(new Date(reservation.expiresAt) - Date.now())} left)` : '—']]
            .map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-bold text-slate-800">{v}</span></div>)}
          <Btn className="w-full" disabled={reservation?.status !== 'held'} busy={busy} onClick={() => run(() => api('POST', `/reservations/${reservation._id}/check-in`), 'Citizen checked in')}>Citizen arrived · check in</Btn>
          <Btn tone="danger" className="w-full" busy={busy} onClick={() => run(() => api('POST', `/reservations/${reservation._id}/cancel`), 'Hold released')}>Release hold</Btn>
        </div>
      )}
      <ErrorNote error={err} />
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   WORKER: VEHICLE QUEUE (drivers who reserved and are on their way)
────────────────────────────────────────────────────────────────────────── */
function WorkerQueue({ lot, showToast }) {
  const q = useLoad(async () => {
    const { slots } = await api('GET', `/lots/${encodeURIComponent(lot._id)}`);
    const held = slots.filter((s) => s.state === 'reserved');
    const details = await Promise.all(held.map((s) => api('GET', `/attendant/slots/${encodeURIComponent(s._id)}`).catch(() => null)));
    return details.filter(Boolean).sort((a, b) => new Date(a.reservation?.expiresAt ?? 0) - new Date(b.reservation?.expiresAt ?? 0));
  }, [lot._id]);
  useLive({ 'slot:update': (u) => { if (u.lotId === lot._id) { clearTimeout(window.__pkQ); window.__pkQ = setTimeout(q.reload, 600); } } });
  const run = async (fn, msg) => { try { await fn(); showToast(msg); q.reload(); } catch (e) { showToast(e.message); } };
  return (
    <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs max-w-2xl">
      <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Vehicle Queue — {lot.name}</h3>
      <p className="mt-3 text-xs text-slate-500">Citizens who reserved a slot in the app and are on their way.</p>
      <div className="space-y-3 mt-4">
        {q.loading && !q.data ? <Loading /> : (q.data ?? []).length === 0 ? <p className="text-xs text-slate-500">No reservations waiting right now.</p> : q.data.map((v, i) => (
          <div key={v.slot._id} className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
            <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 font-black text-sm flex items-center justify-center shrink-0">
              {i + 1}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 font-mono">{v.reservation?._id ?? '—'}</p>
              <p className="text-[11px] text-slate-500">Slot: {v.slot.number} · hold ends {v.reservation ? `${time(v.reservation.expiresAt)} (${duration(new Date(v.reservation.expiresAt) - Date.now())})` : '—'}</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-50 text-amber-700 font-bold">{v.reservation?.status === 'held' ? 'App Lock · paid' : 'Awaiting payment'}</span>
            {v.reservation?.status === 'held'
              ? <button type="button" onClick={() => run(() => api('POST', `/reservations/${v.reservation._id}/check-in`), `Checked in at ${v.slot.number}`)} className="px-3 py-1.5 rounded-full bg-sky-600 text-white text-[10px] font-bold cursor-pointer hover:bg-sky-500">Check in</button>
              : <button type="button" onClick={() => run(() => api('POST', `/reservations/${v.reservation._id}/cancel`), 'Hold released')} className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold cursor-pointer hover:bg-slate-200">Clear</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   WORKER: DAILY REPORT
────────────────────────────────────────────────────────────────────────── */
function WorkerReport({ lot, showToast }) {
  const t = useTransactions(lot._id);
  const p = t.data?.payments ?? [];
  const upi = p.filter((x) => x.method === 'upi'), cash = p.filter((x) => x.method === 'cash');
  const sum = (a) => inr(a.reduce((x, y) => x + y.amountInr, 0));
  const exportCsv = () => {
    downloadCsv(`parkd-${lot._id}-report.csv`, [['Time', 'Slot', 'Method', 'App', 'Purpose', 'Amount (INR)', 'Reference'], ...p.map((x) => [dateTime(x.createdAt), x.slotNumber, x.method, x.upiApp ?? '', x.purpose, x.amountInr, x.reference])]);
    showToast('Report exported (CSV)');
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
      <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Last 24 h · {lot.name.replace(' Parking', '')}</h3>
        {t.loading && !t.data ? <Loading /> : (
          <div className="mt-4 space-y-3 text-sm">
            {[
              ['Payments recorded', p.length],
              ['Currently Inside', lot.stats.occupied],
              ['UPI Collections', `${sum(upi)} (${upi.length})`],
              ['Cash Collections', `${sum(cash)} (${cash.length})`],
              ['App reservations', p.filter((x) => x.purpose === 'reservation').length],
              ['Corrections logged', (t.data?.log ?? []).filter((l) => l.action === 'slot.correct').length]
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-500 text-xs">{k}</span>
                <span className="font-bold text-slate-800 text-xs">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs flex flex-col">
        <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Generate Report</h3>
        <div className="flex-1 space-y-2 mt-4">
          {[['Export CSV Data', exportCsv], ['Print Report', () => window.print()]].map(([a, fn]) => (
            <button
              key={a}
              type="button"
              onClick={fn}
              className="w-full px-4 py-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold border border-sky-100 transition-all cursor-pointer flex items-center justify-between"
            >
              <span>{a}</span>
              <ChevronRight className="w-3.5 h-3.5 text-sky-400" />
            </button>
          ))}
          <p className="text-[10px] font-mono text-slate-400 pt-2">Payments are simulated in this demo.</p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   WORKER: BARRIER CONTROL (demo — no gate hardware is connected)
────────────────────────────────────────────────────────────────────────── */
function WorkerBarrier({ lot, barrierOpen, handleToggleBarrier }) {
  return (
    <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs max-w-md">
      <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Barrier Gate — {lot?.name ?? 'your lot'}</h3>
      <div className="flex flex-col items-center gap-6 mt-8">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg border-4 ${
          barrierOpen ? 'bg-emerald-50 border-emerald-400' : 'bg-slate-100 border-slate-300'
        }`}>
          <ShieldAlert className={`w-10 h-10 ${barrierOpen ? 'text-emerald-600' : 'text-slate-500'}`} />
        </div>
        <p className={`text-xl font-black ${barrierOpen ? 'text-emerald-600' : 'text-slate-800'}`}>
          {barrierOpen ? 'GATE OPEN' : 'GATE ARMED'}
        </p>
        <button
          type="button"
          onClick={handleToggleBarrier}
          className={`px-10 py-3 rounded-full font-bold text-sm shadow-md cursor-pointer transition-all ${
            barrierOpen ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {barrierOpen ? 'Close Gate' : 'Open Gate'}
        </button>
        <p className="text-[11px] text-slate-400 font-mono text-center">
          Demo control only — no barrier hardware is connected.<br />Entries and exits are recorded from the My Lot screen.
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   DEV: HOME OVERVIEW
────────────────────────────────────────────────────────────────────────── */
function DevHome({ overview, onViewAnalytics }) {
  const o = overview.data;
  const health = useLoad(() => api('GET', '/health'));
  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Network overview</h2>
        <p className="mt-1 text-sm text-slate-500">Current operating status across Chandigarh municipal parking. {o?.note}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Lots open now', value: o ? `${o.lots.openNow} / ${o.lots.total}` : '—', status: 'Others are outside opening hours', tone: 'text-emerald-700 bg-emerald-50' },
          { label: 'Open spaces', value: o ? o.available : '—', status: 'Across the network', tone: 'text-sky-700 bg-sky-50' },
          { label: 'Services', value: health.error ? 'Offline' : health.data ? 'Operational' : '—', status: health.data ? `AI assistant: ${health.data.ai ? 'GroqCloud' : 'rules fallback'}` : 'Checking…', tone: health.error ? 'text-rose-700 bg-rose-50' : 'text-emerald-700 bg-emerald-50' }
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{item.value}</p>
            <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.tone}`}>{item.status}</span>
          </div>
        ))}
      </div>
      {o?.alerts?.length > 0 && (
        <div className="rounded-2xl border border-rose-100 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">Alerts · lots at 85% or more</p>
          <div className="mt-2 divide-y divide-slate-100 text-xs">{o.alerts.map((a) => <div key={a.lotId} className="py-2 flex justify-between"><span>{a.name}</span><span className="font-bold text-rose-600">{a.occupancyPct}% · {a.available} free</span></div>)}</div>
        </div>
      )}
      <div className="flex flex-col gap-4 rounded-2xl border border-purple-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Performance and revenue trends</p>
          <p className="mt-1 text-xs text-slate-500">Review occupancy, booking volume, and municipal collections.</p>
        </div>
        <button type="button" onClick={onViewAnalytics} className="inline-flex items-center justify-center gap-2 rounded-full bg-purple-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-purple-700">
          Open analytics <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   DEV: ANALYTICS
────────────────────────────────────────────────────────────────────────── */
function DevAnalytics({ showToast, overview, lots }) {
  const hourly = useLoad(() => api('GET', '/admin/hourly'));
  const audit = useLoad(() => api('GET', '/admin/audit?limit=6'));
  const [insights, setInsights] = useState(null);
  const [busy, setBusy] = useState(false);
  useLive({ 'lot:update': () => { clearTimeout(window.__pkAu); window.__pkAu = setTimeout(audit.reload, 1500); } });
  const hours = hourly.data?.hours ?? [];
  const max = Math.max(1, ...hours.map((h) => h.entries));
  const nowH = Number(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }));
  const top = [...lots].filter((l) => l.kind !== 'temporary').sort((a, b) => b.stats.occupancyPct - a.stats.occupancyPct).slice(0, 5);
  const o = overview.data;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-8 space-y-6">
        <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Entries per Hour (last 24 h)</h3>
              <p className="text-xs text-slate-500 font-mono">Chandigarh time · demo data (seeded and simulated activity)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-semibold text-emerald-600">LIVE SYNC</span>
            </div>
          </div>

          <div className="py-6">
            {hourly.loading && !hourly.data ? <Loading /> : (
              <div className="w-full space-y-2">
                {/* Fixed-height Bar Area (all bars share the exact same baseline) */}
                <div className="h-48 w-full flex items-end gap-1 sm:gap-2 px-1 border-b border-slate-100 pb-1">
                  {hours.map((bar) => {
                    const peak = bar.entries >= max * 0.75;
                    const pct = max > 0 ? (bar.entries / max) * 100 : 0;
                    const isNow = bar.hour === nowH;
                    return (
                      <div key={bar.hour} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                        {/* Hover Tooltip count */}
                        <div className="absolute -top-7 text-[10px] font-mono font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {bar.entries} entries
                        </div>
                        {/* The Bar */}
                        <div
                          className={`w-full rounded-t-md transition-all duration-300 ${
                            peak
                              ? 'bg-gradient-to-t from-sky-600 to-sky-400 group-hover:from-sky-500 group-hover:to-sky-300'
                              : bar.entries > 0
                              ? 'bg-gradient-to-t from-sky-200 to-sky-100 group-hover:from-sky-300 group-hover:to-sky-200'
                              : 'bg-slate-100 group-hover:bg-slate-200'
                          } ${isNow ? 'ring-2 ring-purple-500 ring-offset-1' : ''}`}
                          style={{
                            height: bar.entries > 0 ? `${Math.max(4, pct)}%` : '3px',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Hour Labels aligned below the baseline */}
                <div className="w-full flex items-center gap-1 sm:gap-2 px-1">
                  {hours.map((bar) => (
                    <div key={`lbl-${bar.hour}`} className="flex-1 text-center">
                      <span className={`text-[10px] font-mono block ${bar.hour === nowH ? 'font-bold text-purple-600' : 'text-slate-400'}`}>
                        {bar.hour % 3 === 0 ? String(bar.hour).padStart(2, '0') : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
            <div><span className="text-[10px] font-mono text-slate-400 uppercase">Revenue 24 h</span><div className="text-xs font-bold text-emerald-600">{o ? inr(o.revenue.totalInr) : '—'}</div></div>
            <div><span className="text-[10px] font-mono text-slate-400 uppercase">UPI share</span><div className="text-xs font-bold text-emerald-600">{o?.revenue.totalInr ? `${Math.round((o.revenue.upiInr / o.revenue.totalInr) * 100)}%` : '—'}</div></div>
            <div><span className="text-[10px] font-mono text-slate-400 uppercase">15m Lock Engine</span><div className="text-xs font-bold text-sky-600">Conflict-checked on server</div></div>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900 text-slate-200 shadow-sm border border-slate-800">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
            <span className="text-xs font-mono font-bold uppercase text-sky-400">Audit Log · latest</span>
            <button type="button" onClick={async () => { setBusy(true); try { const r = await api('GET', '/admin/insights'); setInsights(r); } catch (e) { showToast(e.message); } finally { setBusy(false); } }} className="text-[10px] font-mono text-purple-300 hover:text-purple-200">{busy ? 'Thinking…' : 'Generate AI insights →'}</button>
          </div>
          {insights && <div className="mb-3 space-y-1 text-xs text-purple-200">{insights.insights.map((x, i) => <p key={i}>💡 {x}</p>)}<p className="text-[10px] text-slate-500">{insights.source === 'groq' ? 'from GroqCloud' : 'rule-based (no Groq key)'}</p></div>}
          <div className="space-y-1.5 font-mono text-xs">
            {(audit.data?.entries ?? []).map((l) => (
              <div key={l._id} className="text-slate-400"><span className="text-emerald-400">[{time(l.at)}]</span> {l.action.toUpperCase()} · {l.detail}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-4 space-y-6">
        <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Busiest Municipal Lots</h3>
            <button type="button" onClick={() => { overview.reload(); hourly.reload(); showToast('Refreshed'); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100 mt-2">
            {top.map((lot) => {
              const lv = level(lot.stats);
              return (
                <div key={lot._id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">{lot.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">{lot.stats.available} of {lot.capacity} spots free</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${lv.key === 'ok' ? 'bg-emerald-50 text-emerald-700' : lv.key === 'warn' ? 'bg-amber-50 text-amber-700' : lv.key === 'closed' ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-700'}`}>{lv.key === 'ok' ? 'Healthy' : lv.key === 'warn' ? 'High Load' : lv.key === 'closed' ? 'Closed' : 'Near Full'}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[10px] font-mono text-slate-400">To simulate a crowd, use Festival Mode → "Demo: trigger overflow".</p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   DEV: ALL LOTS MAP
────────────────────────────────────────────────────────────────────────── */
function DevAllLots({ showToast, lots, initialQuery }) {
  const [q, setQ] = useState(initialQuery || '');
  const [open, setOpen] = useState(null);
  const all = (lots.data?.lots ?? []).filter((l) => !q || `${l.name} ${l.sector}`.toLowerCase().includes(q.toLowerCase()));
  const markers = all.map((l) => ({ id: l._id, lat: l.lat, lng: l.lng, text: l.stats.open ? l.stats.available : '—', tone: l.kind === 'temporary' ? 'temp' : level(l.stats).key, title: l.name }));
  const lot = all.find((l) => l._id === open);
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">All Municipal Lots — Network Overview</h3>
            <p className="text-xs text-slate-500">Click any lot to change its fee. Demo lots; coordinates not verified.</p>
          </div>
          <div className="flex items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="px-3 py-1.5 rounded-full border border-slate-200 text-xs w-32" aria-label="Filter lots" />
            <button type="button" onClick={() => { lots.reload(); showToast('Lots refreshed'); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="mt-5 rounded-2xl overflow-hidden border border-slate-100"><LiveMap markers={markers} onSelect={setOpen} className="h-72" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {all.map((l) => {
            const lv = level(l.stats);
            return (
              <button
                key={l._id}
                type="button"
                onClick={() => setOpen(l._id)}
                className="p-4 rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-sm transition-all text-left cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-8 h-8 rounded-lg ${l.kind === 'temporary' ? 'bg-yellow-200 text-yellow-900' : 'bg-sky-100 text-sky-700'} font-black text-xs flex items-center justify-center`}>S{String(l.sector).replace(/\D/g, '').slice(0, 2) || '·'}</div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold ${lv.key === 'ok' ? 'bg-emerald-50 text-emerald-700' : lv.key === 'warn' ? 'bg-amber-50 text-amber-700' : lv.key === 'closed' ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-700'}`}>{lv.key === 'ok' ? 'Healthy' : lv.key === 'warn' ? 'High Load' : lv.key === 'closed' ? 'Closed' : 'Near Full'}</span>
                </div>
                <p className="text-xs font-bold text-slate-800 mt-2">{l.name}</p>
                <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(l.stats.available / l.capacity) * 100}%`, backgroundColor: lv.bar }} />
                </div>
                <p className="text-[10px] font-mono text-slate-500 mt-1">{l.stats.available} / {l.capacity} free · {inr(l.feeInr)}</p>
              </button>
            );
          })}
        </div>
      </div>
      {lot && <LotFeeModal lot={lot} onClose={() => setOpen(null)} showToast={showToast} onSaved={lots.reload} />}
    </div>
  );
}
function LotFeeModal({ lot, onClose, showToast, onSaved }) {
  const [fee, setFee] = useState(lot.feeInr);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  return (
    <Modal title={lot.name} sub={`${sectorLabel(lot.sector)} · ${lot.address}`} onClose={onClose}>
      <div className="space-y-3 text-xs">
        {[['Capacity', lot.capacity], ['Free now', lot.stats.available], ['Occupancy', `${lot.stats.occupancyPct}%`], ['Reservable (10%)', `${lot.stats.reservableFree} / ${lot.stats.reservableTotal}`], ['Hours', lot.opensAt === 0 && lot.closesAt === 24 ? 'Open 24 h' : `${lot.opensAt}:00–${lot.closesAt}:00`]]
          .map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-bold">{v}</span></div>)}
        {lot.kind !== 'temporary' && (<>
          <Field label="Fee per visit (₹)"><input className={inputCls} inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
          <ErrorNote error={err} />
          <Btn tone="purple" className="w-full" busy={busy} onClick={async () => { setBusy(true); setErr(null); try { await api('PATCH', `/admin/lots/${lot._id}`, { feeInr: Number(fee) }); showToast('Fee updated (logged in the audit log)'); onSaved(); onClose(); } catch (e) { setErr(e); } finally { setBusy(false); } }}>Save fee</Btn>
        </>)}
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   DEV: SYSTEM LOGS (the audit log — every action on the server)
────────────────────────────────────────────────────────────────────────── */
const LOG_COLOR = { slot: 'text-emerald-400', reservation: 'text-sky-400', payment: 'text-emerald-400', lot: 'text-amber-400', zone: 'text-yellow-300', overflow: 'text-rose-400', listing: 'text-blue-300', system: 'text-slate-500' };
function DevLogs() {
  const [type, setType] = useState('all');
  const logs = useLoad(() => api('GET', `/admin/audit?type=${type}&limit=150`), [type]);
  useLive({ 'lot:update': () => { clearTimeout(window.__pkLg); window.__pkLg = setTimeout(logs.reload, 1500); }, 'zone:update': () => logs.reload(), 'listing:update': () => logs.reload() });
  return (
    <div className="p-6 rounded-3xl bg-slate-900 text-slate-200 shadow-sm border border-slate-800 max-w-4xl">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800 gap-3">
        <span className="text-xs font-mono font-bold uppercase text-sky-400">Audit Log — Full Stream</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-200 px-2 py-1">
            {['all', 'slot', 'reservation', 'payment', 'lot', 'zone', 'overflow', 'listing', 'system'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-2 font-mono text-xs max-h-[65vh] overflow-y-auto">
        {logs.loading && !logs.data ? <p className="text-slate-500">Loading…</p> : (logs.data?.entries ?? []).map((l) => (
          <div key={l._id} className="text-slate-400 hover:bg-slate-800/50 px-2 py-1 rounded transition-colors">
            <span className={LOG_COLOR[l.action.split('.')[0]] ?? 'text-sky-400'}>[{dateTime(l.at)}]</span> {l.action.toUpperCase()} · {l.actorName || l.actorRole} · {l.detail}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   DEV: USER MANAGEMENT (staff accounts)
────────────────────────────────────────────────────────────────────────── */
function DevUsers({ showToast }) {
  const r = useLoad(() => api('GET', '/admin/attendants'));
  const users = r.data?.attendants ?? [];
  return (
    <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs max-w-4xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900">User Management</h3>
          <p className="text-xs text-slate-500">Parking attendants on the Park'd network, with the last 24 h of collections.</p>
        </div>
        <button
          type="button"
          disabled={!users.length}
          onClick={() => { downloadCsv('parkd-staff.csv', [['Name', 'Staff ID', 'Lots', 'Collected 24h (INR)', 'Cash to deposit (INR)', 'Corrections'], ...users.map((u) => [u.name, u.username, u.assignedLotIds.join(' '), u.collectedInr, u.cashToDepositInr, u.corrections])]); showToast('Staff list exported (CSV)'); }}
          className="px-4 py-2 rounded-full bg-sky-600 text-white text-xs font-bold cursor-pointer hover:bg-sky-500 transition-all disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        {r.loading && !r.data ? <Loading /> : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-mono text-slate-400 uppercase border-b border-slate-100">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Staff ID</th>
                <th className="pb-2 pr-4">Lots</th>
                <th className="pb-2 pr-4">Collected 24 h</th>
                <th className="pb-2 pr-4">Cash to deposit</th>
                <th className="pb-2">Corrections</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4 font-bold text-slate-800">{u.name}</td>
                  <td className="py-3 pr-4"><span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700">Worker</span></td>
                  <td className="py-3 pr-4 font-mono text-slate-500">{u.username}</td>
                  <td className="py-3 pr-4 text-slate-600">{u.assignedLotIds.length}</td>
                  <td className="py-3 pr-4 text-slate-600">{inr(u.collectedInr)}</td>
                  <td className="py-3 pr-4 text-slate-600">{inr(u.cashToDepositInr)}</td>
                  <td className="py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${u.corrections ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{u.corrections}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   DEV: API HEALTH (measured from this browser)
────────────────────────────────────────────────────────────────────────── */
const ENDPOINTS = [
  ['GET', '/health'], ['GET', '/lots'], ['GET', '/festival'], ['GET', '/listings'], ['GET', '/admin/overview'], ['GET', '/notifications'],
];
function DevApiHealth({ showToast }) {
  const [rows, setRows] = useState([]);
  const check = async () => {
    const out = await Promise.all(ENDPOINTS.map(async ([method, path]) => {
      const t0 = performance.now();
      try { await api(method, path); return { method, path, ms: Math.round(performance.now() - t0), ok: true }; }
      catch (e) { return { method, path, ms: Math.round(performance.now() - t0), ok: false, err: e.message }; }
    }));
    setRows(out);
  };
  useEffect(() => { check(); }, []);
  return (
    <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-xs max-w-4xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900">API Health Dashboard</h3>
          <p className="text-xs text-slate-500 font-mono">Response times measured from this browser just now.</p>
        </div>
        <button type="button" onClick={() => { check(); showToast('API health check triggered'); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {rows.length === 0 && <Loading label="Checking endpoints…" />}
        {rows.map((ep) => (
          <div key={ep.path} className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4 hover:border-sky-200 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-black shrink-0 bg-sky-100 text-sky-700">{ep.method}</span>
              <span className="text-xs font-mono text-slate-700 truncate">/api{ep.path}</span>
            </div>
            <div className="flex items-center gap-4 shrink-0 text-[11px] font-mono">
              <span className="text-slate-500">{ep.ms}ms</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                ep.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`} title={ep.err}>{ep.ok ? 'OK' : 'Error'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
