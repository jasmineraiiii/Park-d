// Self-contained, guaranteed high-quality SVG illustrations for each problem card
// These never fail to load over the network and render instantly with crisp vector fidelity.

export const createSvgImage = (title, subtitle, type = 'traffic') => {
  const isTraffic = type === 'traffic';
  const isNav = type === 'nav';
  const isCash = type === 'cash';
  const isEmission = type === 'emission';
  const isSensor = type === 'sensor';

  let graphic = '';

  if (isTraffic) {
    graphic = `
      <!-- Sector 17 / 22 Traffic & Parking Congestion -->
      <rect x="60" y="40" width="280" height="140" rx="16" fill="#0f2b59" opacity="0.9" />
      <line x1="60" y1="110" x2="340" y2="110" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 6" />
      <!-- Cars queued in traffic -->
      <rect x="80" y="70" width="60" height="28" rx="8" fill="#ef4444" />
      <circle cx="95" cy="100" r="6" fill="#0f172a" />
      <circle cx="125" cy="100" r="6" fill="#0f172a" />
      <rect x="160" y="70" width="65" height="28" rx="8" fill="#f59e0b" />
      <circle cx="178" cy="100" r="6" fill="#0f172a" />
      <circle cx="210" cy="100" r="6" fill="#0f172a" />
      <rect x="245" y="70" width="65" height="28" rx="8" fill="#ef4444" />
      <circle cx="262" cy="100" r="6" fill="#0f172a" />
      <circle cx="295" cy="100" r="6" fill="#0f172a" />
      <!-- Road sign -->
      <rect x="135" y="14" width="130" height="24" rx="6" fill="#0284c7" />
      <text x="200" y="30" fill="#ffffff" font-size="11" font-weight="bold" font-family="sans-serif" text-anchor="middle">SECTOR 17 &bull; MARKET LOT FULL</text>
    `;
  } else if (isNav) {
    graphic = `
      <!-- GPS Navigation Screen Blind Departures -->
      <rect x="70" y="30" width="260" height="150" rx="14" fill="#0b1e3d" />
      <!-- Map grid lines -->
      <line x1="70" y1="80" x2="330" y2="80" stroke="#1e3a8a" stroke-width="2" />
      <line x1="70" y1="130" x2="330" y2="130" stroke="#1e3a8a" stroke-width="2" />
      <line x1="160" y1="30" x2="160" y2="180" stroke="#1e3a8a" stroke-width="2" />
      <line x1="250" y1="30" x2="250" y2="180" stroke="#1e3a8a" stroke-width="2" />
      <!-- Route line with ? -->
      <path d="M 110 150 Q 160 110 200 130 T 290 60" fill="none" stroke="#f59e0b" stroke-width="4" stroke-dasharray="6 4" />
      <circle cx="110" cy="150" r="8" fill="#38bdf8" />
      <circle cx="290" cy="60" r="14" fill="#ef4444" />
      <text x="290" y="66" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif" text-anchor="middle">?</text>
      <!-- Blind alert -->
      <rect x="100" y="145" width="200" height="26" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1" />
      <text x="200" y="162" fill="#fbbf24" font-size="11" font-weight="bold" font-family="sans-serif" text-anchor="middle">NO LIVE DATA FROM HOME</text>
    `;
  } else if (isCash) {
    graphic = `
      <!-- Paper Parking Slips & Cash Leaks -->
      <rect x="80" y="30" width="140" height="155" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />
      <line x1="95" y1="55" x2="205" y2="55" stroke="#64748b" stroke-width="3" />
      <line x1="95" y1="75" x2="180" y2="75" stroke="#94a3b8" stroke-width="2" />
      <line x1="95" y1="95" x2="195" y2="95" stroke="#94a3b8" stroke-width="2" />
      <line x1="95" y1="115" x2="160" y2="115" stroke="#94a3b8" stroke-width="2" />
      <!-- Stamp -->
      <rect x="105" y="130" width="90" height="30" rx="4" fill="none" stroke="#ef4444" stroke-width="2" transform="rotate(-6 150 145)" />
      <text x="150" y="150" fill="#ef4444" font-size="13" font-weight="extrabold" font-family="sans-serif" text-anchor="middle" transform="rotate(-6 150 145)">PAID CASH</text>
      <!-- Cash overlay notes -->
      <rect x="180" y="55" width="130" height="75" rx="8" fill="#047857" stroke="#10b981" stroke-width="2" transform="rotate(12 245 92)" />
      <circle cx="245" cy="92" r="16" fill="#065f46" transform="rotate(12 245 92)" />
      <text x="245" y="98" fill="#ffffff" font-size="15" font-weight="bold" font-family="sans-serif" text-anchor="middle" transform="rotate(12 245 92)">₹14</text>
    `;
  } else if (isEmission) {
    graphic = `
      <!-- Fuel waste & idling emissions -->
      <rect x="80" y="40" width="240" height="140" rx="16" fill="#0e2340" />
      <!-- Car tailpipe & exhaust smoke puffs -->
      <rect x="90" y="80" width="80" height="35" rx="8" fill="#1e3a8a" />
      <circle cx="105" cy="118" r="7" fill="#0f172a" />
      <circle cx="155" cy="118" r="7" fill="#0f172a" />
      <!-- Exhaust cloud -->
      <circle cx="190" cy="100" r="16" fill="#64748b" opacity="0.7" />
      <circle cx="215" cy="85" r="22" fill="#94a3b8" opacity="0.6" />
      <circle cx="245" cy="75" r="28" fill="#cbd5e1" opacity="0.5" />
      <text x="245" y="80" fill="#0f172a" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">CO₂</text>
      <!-- Fuel burn meter -->
      <rect x="100" y="140" width="200" height="26" rx="6" fill="#b91c1c" />
      <text x="200" y="157" fill="#ffffff" font-size="11" font-weight="bold" font-family="sans-serif" text-anchor="middle">18+ MINS SEARCHING &bull; FUEL LOSS</text>
    `;
  } else {
    // Sensor breakdown
    graphic = `
      <!-- Pavement sensor failure -->
      <rect x="60" y="40" width="280" height="140" rx="16" fill="#1e293b" />
      <!-- Road asphalt texture & crack -->
      <path d="M 120 40 L 150 110 L 140 140 L 170 180" stroke="#475569" stroke-width="3" fill="none" />
      <path d="M 230 40 L 210 90 L 240 140 L 220 180" stroke="#475569" stroke-width="3" fill="none" />
      <!-- Broken sensor in asphalt -->
      <circle cx="200" cy="105" r="32" fill="#334155" stroke="#ef4444" stroke-width="3" stroke-dasharray="8 4" />
      <line x1="180" y1="85" x2="220" y2="125" stroke="#ef4444" stroke-width="4" />
      <line x1="220" y1="85" x2="180" y2="125" stroke="#ef4444" stroke-width="4" />
      <rect x="100" y="145" width="200" height="24" rx="6" fill="#0f172a" />
      <text x="200" y="161" fill="#f87171" font-size="10" font-weight="bold" font-family="sans-serif" text-anchor="middle">IOT SENSOR OFFLINE &bull; DAMAGED</text>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#051226" />
        <stop offset="50%" stop-color="#0a2347" />
        <stop offset="100%" stop-color="#031124" />
      </linearGradient>
    </defs>
    <rect width="400" height="220" fill="url(#bgGrad)" />
    <!-- Background grid -->
    <g opacity="0.08" stroke="#38bdf8" stroke-width="1">
      <line x1="0" y1="44" x2="400" y2="44" />
      <line x1="0" y1="88" x2="400" y2="88" />
      <line x1="0" y1="132" x2="400" y2="132" />
      <line x1="0" y1="176" x2="400" y2="176" />
      <line x1="80" y1="0" x2="80" y2="220" />
      <line x1="160" y1="0" x2="160" y2="220" />
      <line x1="240" y1="0" x2="240" y2="220" />
      <line x1="320" y1="0" x2="320" y2="220" />
    </g>
    ${graphic}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
