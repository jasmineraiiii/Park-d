import { readFileSync, writeFileSync } from 'fs';

const path = 'src/components/Dashboard.jsx';
let src = readFileSync(path, 'utf8');

const startIdx = src.indexOf('const NEARBY_PARKING = [');
const endIdx   = src.indexOf('function DriverReservations');

const newBlock = `const NEARBY_PARKING = [
  { id: 'sec-22-d',  name: 'Sector 22-D Market Parking',    sector: 'Sector 22',       address: 'Near Kiran Cinema, Sector 22-D',        free: 14, total: 40,  reservable: 4,  distance: '0.8 km', eta: '3 min',  lat: 30.7433, lng: 76.7876 },
  { id: 'shastri',   name: 'Shastri Market Parking',        sector: 'Sector 22',       address: 'Shastri Market, Sector 22-B',            free:  7, total: 60,  reservable: 6,  distance: '1.0 km', eta: '4 min',  lat: 30.7445, lng: 76.7892 },
  { id: 'sec-17-ml', name: 'Sector 17 Multi-Level Parking', sector: 'Sector 17',       address: 'Near Sector 17 bus stand, Sector 17',    free: 11, total: 96,  reservable: 9,  distance: '1.4 km', eta: '5 min',  lat: 30.7408, lng: 76.7807 },
  { id: 'neelam',    name: 'Neelam Cinema Parking',         sector: 'Sector 17',       address: 'Near Neelam Cinema, Sector 17',          free:  9, total: 40,  reservable: 4,  distance: '1.6 km', eta: '6 min',  lat: 30.7415, lng: 76.7795 },
  { id: 'sec-35-c',  name: 'Sector 35-C Market Parking',   sector: 'Sector 35',       address: 'Near Aroma Light Point, Sector 35-C',    free: 18, total: 50,  reservable: 7,  distance: '2.6 km', eta: '8 min',  lat: 30.7264, lng: 76.7794 },
  { id: 'sukhna',    name: 'Sukhna Lake Promenade Lot',    sector: 'Sector 6',        address: 'Promenade Road, Sukhna Lake',            free: 32, total: 80,  reservable: 10, distance: '3.1 km', eta: '9 min',  lat: 30.7427, lng: 76.8183 },
  { id: 'elante',    name: 'Elante Mall Surface Lot',       sector: 'Industrial Area', address: 'Elante Mall, Industrial Area Phase I',    free: 45, total: 200, reservable: 12, distance: '3.8 km', eta: '11 min', lat: 30.7056, lng: 76.8013 },
  { id: 'pgi',       name: 'PGI Hospital Parking',          sector: 'Sector 12',       address: 'PGIMER Campus, Sector 12',               free: 22, total: 120, reservable: 8,  distance: '4.2 km', eta: '13 min', lat: 30.7654, lng: 76.7774 },
];

/* Generates per-lot slot data deterministically from the lot object */
function makeSlotsForLot(lot) {
  return Array.from({ length: lot.total }, (_, i) => {
    const n = i + 1;
    const isFree = n <= lot.free;
    const isReserved = !isFree && n <= lot.free + lot.reservable;
    return {
      id: n,
      status: isFree ? 'free' : isReserved ? 'reserved' : 'occupied',
    };
  });
}

/* ── Slot-grid viewer (identical look to the landing page InteractiveLotDemo) ── */
function LotSlotViewer({ lot, onConfirm, onClose }) {
  const [slots, setSlots] = React.useState(() => makeSlotsForLot(lot));
  const [selectedSlot, setSelectedSlot] = React.useState(null);
  const [confirmed, setConfirmed] = React.useState(false);

  const freeSlots     = slots.filter(s => s.status === 'free').length;
  const occupiedSlots = slots.filter(s => s.status === 'occupied').length;
  const reservedSlots = slots.filter(s => s.status === 'reserved').length;
  const pctFull       = Math.round(((lot.total - freeSlots) / lot.total) * 100);

  const handleSlotTap = (slot) => {
    if (slot.status === 'free') setSelectedSlot(slot.id === selectedSlot ? null : slot.id);
  };

  const handleConfirm = () => {
    if (!selectedSlot) return;
    setSlots(prev => prev.map(s => s.id === selectedSlot ? { ...s, status: 'reserved' } : s));
    setConfirmed(true);
    onConfirm({ lotName: lot.name, slotNumber: \`#\${selectedSlot}\`, lockTimeRemaining: '15:00', fee: '₹14' });
    setSelectedSlot(null);
  };

  const handleReset = () => {
    setSlots(makeSlotsForLot(lot));
    setSelectedSlot(null);
    setConfirmed(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-600">Live Slot View</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5 flex items-center gap-2">
              {lot.name}
              <span className={\`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold \${
                pctFull >= 85 ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }\`}>
                {pctFull}% Full
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Tap any green slot to reserve for 15 minutes (₹14)</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 transition-colors"
              title="Reset"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-600 transition-colors text-sm font-bold"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Slot grid */}
        <div className="px-6 pt-4 pb-2">
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
            {slots.map((slot) => {
              const isSelected = selectedSlot === slot.id;
              const isFree     = slot.status === 'free';
              const isOccupied = slot.status === 'occupied';
              const isReserved = slot.status === 'reserved';
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => handleSlotTap(slot)}
                  disabled={!isFree}
                  className={\`aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-150 border text-center relative
                    \${isSelected ? 'ring-2 ring-sky-500 scale-105 z-10 shadow-md' : ''}
                    \${isFree     ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800 cursor-pointer' : ''}
                    \${isOccupied ? 'bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed' : ''}
                    \${isReserved ? 'bg-amber-50 border-amber-300 text-amber-800 cursor-not-allowed' : ''}
                  \`}
                >
                  <span className="text-[9px] font-mono font-bold leading-none">#{slot.id}</span>
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
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Free ({freeSlots})</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" />Occupied ({occupiedSlots})</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />Reserved ({reservedSlots})</span>
            </div>
            <span className="text-[11px] font-mono text-sky-700 font-bold">Standard ₹14 municipal fee</span>
          </div>

          {/* Confirm bar */}
          {confirmed ? (
            <div className="w-full py-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center gap-2 text-emerald-800 text-sm font-bold">
              <Check className="w-4 h-4 text-emerald-600" />
              Slot confirmed! 15-min lock active · ₹14
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex-1 text-xs text-slate-500">
                Selected slot:{' '}
                <span className="font-bold text-slate-900 font-mono">
                  {selectedSlot ? \`#\${selectedSlot}\` : 'Tap a green slot above'}
                </span>
              </div>
              <button
                type="button"
                disabled={!selectedSlot}
                onClick={handleConfirm}
                className={\`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all \${
                  selectedSlot
                    ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }\`}
              >
                Confirm slot · ₹14
                <Navigation className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DriverExplore({ showToast, onReserve }) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewingLot,  setViewingLot]  = React.useState(null); // lot object | null

  const filteredLots = NEARBY_PARKING.filter((lot) =>
    \`\${lot.name} \${lot.sector} \${lot.address}\`.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleConfirmSlot = ({ lotName, slotNumber, lockTimeRemaining, fee }) => {
    onReserve({ lotName, slotNumber, lockTimeRemaining, fee });
    showToast(\`Slot \${slotNumber} confirmed at \${lotName} · 15-min lock active\`);
    setTimeout(() => setViewingLot(null), 1800); // close after brief confirmation
  };

  const openDirections = (lot) => {
    const url = \`https://www.google.com/maps/dir/?api=1&destination=\${encodeURIComponent(lot.address + ', Chandigarh')}&travelmode=driving\`;
    window.open(url, '_blank', 'noreferrer');
  };

  const getBarColor = (free, total) => {
    const p = free / total;
    return p > 0.3 ? '#22c55e' : p > 0.1 ? '#f59e0b' : '#ef4444';
  };

  const getAvail = (free, total) => {
    const p = free / total;
    if (p > 0.3) return { text: 'Plenty',    bg: 'bg-green-100', color: 'text-green-700' };
    if (p > 0.1) return { text: 'Limited',   bg: 'bg-amber-100', color: 'text-amber-700' };
    return             { text: 'Almost Full', bg: 'bg-red-100',   color: 'text-red-600'   };
  };

  return (
    <div className="space-y-6">
      {/* Slot-grid modal */}
      {viewingLot && (
        <LotSlotViewer
          lot={viewingLot}
          onConfirm={handleConfirmSlot}
          onClose={() => setViewingLot(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Parking near you</h2>
          <p className="text-sm text-slate-500 mt-0.5">Availability and distances update in the list.</p>
        </div>
        <span className="text-xs text-slate-500 font-medium">{filteredLots.length} locations</span>
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

      {/* Google Maps embed */}
      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-xs">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Live map · Chandigarh</h3>
            <p className="text-xs text-slate-500">Municipal parking zones across sectors</p>
          </div>
          <a
            href="https://www.google.com/maps/search/parking+chandigarh/@30.7333,76.7794,13z"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-700 hover:text-sky-800 px-3 py-1.5 rounded-full bg-sky-50 hover:bg-sky-100 transition-all"
          >
            <MapPin className="h-3 w-3" /> Open in Maps
          </a>
        </div>
        <div className="relative h-72 sm:h-96 w-full">
          <iframe
            title="Chandigarh Parking Map"
            src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d54885.43!2d76.7794!3d30.7333!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sin!4v1"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </section>

      {/* Card grid */}
      {filteredLots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No parking lots match that search.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLots.map((lot) => {
            const pctFull  = Math.round(((lot.total - lot.free) / lot.total) * 100);
            const avail    = getAvail(lot.free, lot.total);
            const barColor = getBarColor(lot.free, lot.total);

            return (
              <article
                key={lot.id}
                className="rounded-2xl border-2 border-slate-200 hover:border-sky-200 hover:shadow-sm bg-white p-5 transition-all"
              >
                {/* Name + free count */}
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{lot.name}</h4>
                  <div className="text-right shrink-0">
                    <span className="text-xl font-black text-slate-900">{lot.free}</span>
                    <span className="text-xs text-slate-400">/{lot.total}</span>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">SLOTS FREE</p>
                  </div>
                </div>

                {/* Address */}
                <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                  {lot.sector} · {lot.address}
                </p>

                {/* Badges */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold \${avail.bg} \${avail.color}\`}>
                    {lot.free} free · {avail.text}
                  </span>
                  <span className="text-[11px] text-slate-500">{pctFull}% full</span>
                  <span className="text-[11px] text-slate-500">₹14/entry</span>
                </div>

                {/* Status row */}
                <div className="mt-2 flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 font-semibold text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Open
                  </span>
                  <span className="text-slate-500">🗓 {lot.reservable} reservable</span>
                  <span className="text-slate-400 ml-auto">{lot.distance} · {lot.eta}</span>
                </div>

                {/* Availability bar */}
                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: \`\${pctFull}%\`, backgroundColor: barColor }} />
                </div>

                {/* Buttons */}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setViewingLot(lot)}
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

`;

src = src.slice(0, startIdx) + newBlock + src.slice(endIdx);
writeFileSync(path, src, 'utf8');
console.log('Done. File size:', src.length);
