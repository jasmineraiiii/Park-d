// Park'd voice assistant for citizens.
// Greets the citizen right after they log in, asks where they're going, reads out
// live free spaces near that place, and reserves a spot if they say yes.
// Uses the browser's own speech (no API key): speechSynthesis to talk and
// SpeechRecognition (Chrome, Edge, Safari) to listen. A text box works everywhere.
import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X, Navigation, Send } from 'lucide-react';
import { api, directionsUrl, inr, UPI_APPS } from '../lib/api';

function HoldTimer({ to }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = new Date(to).getTime() - now;
  if (!(ms > 0)) return <span>hold expired</span>;
  return <span className="tabular-nums">{String(Math.floor(ms / 60000)).padStart(2, '0')}:{String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')} left on hold</span>;
}

const GREET_KEY = 'parkd.greet';
const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const YES = /\b(yes|yeah|yep|yup|sure|ok|okay|please|go ahead|do it|reserve|book|haan|han|ha|ji|theek)\b/i;
const NO = /\b(no|nope|nah|not now|don'?t|cancel|nahi|nahin|na)\b/i;

const TAKEN = /\b(taken|occupied|someone('?s| is)? (already )?(parked|in)|already (a car|parked|full)|slot (is )?(full|taken)|not (free|empty)|car (is )?(already )?(there|in it))\b/i;

// Where the citizen is now (for travel time). Asked once; falls back silently.
let herePromise = null;
function whereAmI() {
  if (!herePromise) {
    herePromise = new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { timeout: 6000, maximumAge: 120000 });
    });
  }
  return herePromise;
}

/** "You're about 12 minutes away. I expect around 6 spaces to still be free when you get there." */
async function arrivalForecast(lot) {
  try {
    const here = await whereAmI();
    const q = here ? `lat=${here.lat}&lng=${here.lng}` : 'etaMin=15';
    const f = await api('GET', `/lots/${encodeURIComponent(lot._id)}/forecast?${q}`);
    const n = f.predictedFree, s = n === 1 ? '' : 's';
    const lead = here ? `You're about ${f.etaMin} minutes away.` : 'If you arrive in about 15 minutes,';
    const text = f.verdict === 'closing' ? `${lead} Careful, it may close before you get there.`
      : f.verdict === 'likely' ? `${lead} Going by the last hour, I expect around ${n} space${s} to still be free${here ? ' when you arrive' : ''}.`
      : f.verdict === 'tight' ? `${lead} It's filling up, so only about ${n} space${s} may be left${here ? ' when you arrive' : ''}.`
      : `${lead} At this rate it will probably be full by then.`;
    return { text, verdict: f.verdict };
  } catch { return { text: '', verdict: null }; }
}

const isYes = (t) => YES.test(t) && !NO.test(t.replace(/no problem/i, ''));
const isNo = (t) => NO.test(t) && !isYes(t);
function upiFrom(t) {
  if (/g\s*pay|google\s*pay/i.test(t)) return 'Google Pay';
  if (/phone\s*pe|phonepay/i.test(t)) return 'PhonePe';
  if (/paytm|pay tm/i.test(t)) return 'Paytm';
  if (/bhim|bheem/i.test(t)) return 'BHIM';
  return null;
}
const ordinalWord = (n) => `${n}${[, 'st', 'nd', 'rd'][n % 100 >> 3 ^ 1 && n % 10] || 'th'}`;

/** "Row I, the 9th bay from the entrance" — bays are numbered from the entrance, 10 to a row (same as the slot guide). */
async function bayDirections(lotId, slotNumber) {
  try {
    const { slots } = await api('GET', `/lots/${encodeURIComponent(lotId)}`);
    const i = [...(slots ?? [])].sort((a, b) => a.order - b.order).findIndex((x) => x.number === slotNumber);
    if (i < 0) return '';
    return ` It's in row ${String.fromCharCode(65 + Math.floor(i / 10))}, the ${ordinalWord((i % 10) + 1)} bay from the entrance.`;
  } catch { return ''; }
}

/** "I want to go to sector 17 please" → "sector 17" */
function placeFrom(text) {
  let t = String(text || '').toLowerCase().replace(/[.,!?]/g, ' ');
  t = t.replace(/\b(i\s+(want|wanna|would like|need)\s+to\s+(go|visit|park)( to| at| near| in)?|take me to|going to|go to|i'?m going to|let'?s go to|navigate to|parking (at|near|in)|park (at|near|in)|near|please|today|now|the)\b/g, ' ');
  t = t.replace(/\bsector\s*(\d+)/, 'sector $1').replace(/^\s*(\d{1,2})\s*$/, 'sector $1');
  return t.replace(/\s+/g, ' ').trim();
}

function partOfDay() {
  const h = Number(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }));
  return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : 'evening';
}

// Prefer voices built into the device (online voices can fail silently), Indian English first.
function pickVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  const local = voices.filter((v) => v.localService);
  const by = (list, re) => list.find((v) => re.test(v.lang));
  return by(local, /en[-_]IN/i) || by(local, /en[-_]GB/i) || by(local, /^en/i)
    || by(voices, /en[-_]IN/i) || by(voices, /^en/i) || null;
}

// Voices load a moment after the page; wait (briefly) for them the first time.
let voicesReady = null;
function whenVoicesReady() {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve();
  if (synth.getVoices().length) return Promise.resolve();
  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      const t = setTimeout(resolve, 1200);
      synth.addEventListener?.('voiceschanged', () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }
  return voicesReady;
}

// Chrome cuts off speech longer than ~15 s, so speak sentence by sentence.
const sentences = (text) => String(text).match(/[^.!?]+[.!?]*/g)?.map((x) => x.trim()).filter(Boolean) ?? [String(text)];

/** The Park'd robot: floats, blinks, waves on hover, hops when tapped, bounces while it talks. */
function Robot({ size = 92, talking = false, listening = false, mood = 'idle', className = '' }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let t;
    const loop = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 140); loop(); }, 2500 + Math.random() * 3000); };
    loop();
    return () => clearTimeout(t);
  }, []);
  const anim = talking ? 'bot-talk' : mood === 'hop' ? 'bot-hop' : mood === 'wave' ? 'bot-wave' : '';
  return (
    <span className={`relative inline-block ${className}`} style={{ width: size, height: size * 1.21 }}>
      {listening && <span className="absolute inset-x-2 top-[18%] h-[42%] rounded-2xl ring-4 ring-sky-400/60 animate-ping" />}
      <img src={blink ? '/brand/robot-blink.png' : '/brand/robot.png'} alt="" draggable={false}
        className={`relative w-full h-full object-contain select-none ${anim}`} style={{ imageRendering: 'pixelated' }} />
    </span>
  );
}

const HINTS = ['Need parking? Tap me!', 'Try saying "Sector 17"', 'I can reserve a spot for you', 'Ask me where to park'];

/** Floating robot launcher (replaces the old blue button). */
function RobotLauncher({ firstName, onOpen }) {
  const [mood, setMood] = useState('idle');
  const [bubble, setBubble] = useState(null);
  const [tilt, setTilt] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const first = setTimeout(() => setBubble(`Hi ${firstName}! 👋`), 900);
    const hide = setTimeout(() => setBubble(null), 5200);
    let i = 0;
    const every = setInterval(() => { setBubble(HINTS[i++ % HINTS.length]); setTimeout(() => setBubble(null), 4200); }, 40000);
    // Lean slightly towards the mouse, so it feels alive.
    const onMove = (e) => {
      const r = ref.current?.getBoundingClientRect(); if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2);
      setTilt(Math.max(-8, Math.min(8, dx / 60)));
    };
    window.addEventListener('mousemove', onMove);
    return () => { clearTimeout(first); clearTimeout(hide); clearInterval(every); window.removeEventListener('mousemove', onMove); };
  }, [firstName]);
  const click = () => { setMood('hop'); setBubble('On it!'); setTimeout(() => { setMood('idle'); setBubble(null); onOpen(); }, 450); };
  return (
    <div ref={ref} className="fixed bottom-3 right-3 sm:bottom-5 sm:right-6 z-[55] flex flex-col items-end">
      {bubble && (
        <div className="bot-bubble mb-1 mr-4 sm:mr-6 max-w-[180px] sm:max-w-[200px] px-3 py-2 rounded-2xl rounded-br-sm bg-white border border-sky-200 shadow-lg text-[12px] font-bold text-slate-800">
          {bubble}
        </div>
      )}
      <button type="button" onClick={click} aria-label="Open the Park'd assistant"
        onMouseEnter={() => { setMood('wave'); setBubble((b) => b || 'Where to today?'); }}
        onMouseLeave={() => setMood('idle')}
        onAnimationEnd={() => mood === 'wave' && setMood('idle')}
        className="group relative cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 rounded-3xl transition-transform duration-300"
        style={{ transform: `rotate(${tilt}deg)` }}>
        <span className="block bot-float"><Robot size={typeof window !== 'undefined' && window.innerWidth < 640 ? 64 : 88} mood={mood} /></span>
        <span className="bot-shadow absolute -bottom-1 left-1/2 -translate-x-1/2 w-14 h-2.5 rounded-full bg-slate-900/30 blur-[2px]" />
        <span className="absolute -top-1 -left-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-md ring-2 ring-white">
          <Mic className="w-3.5 h-3.5" />
        </span>
      </button>
    </div>
  );
}

/** Call once, right after a successful sign-in, so the assistant greets on the dashboard. */
export function markJustLoggedIn() {
  try { sessionStorage.setItem(GREET_KEY, '1'); } catch { /* private mode */ }
}

export default function VoiceAssistant({ userName, onChanged, showToast }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);          // { from: 'ai' | 'me', text }
  const [stage, setStage] = useState('idle');     // idle | ask-place | ask-reserve | reserved | done
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [typed, setTyped] = useState('');
  const [offer, setOffer] = useState(null);       // { lot, place }
  const [held, setHeld] = useState(null);         // reservation
  const [busy, setBusy] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const recRef = useRef(null);
  const stageRef = useRef(stage);
  const offerRef = useRef(offer);
  const heldRef = useRef(held);
  const retryRef = useRef(0);
  const mutedRef = useRef(muted);
  const listRef = useRef(null);
  stageRef.current = stage; offerRef.current = offer; mutedRef.current = muted; heldRef.current = held;

  const first = String(userName || '').split(' ')[0] || 'there';

  // Greet once after login.
  useEffect(() => {
    let flag = null;
    try { flag = sessionStorage.getItem(GREET_KEY); sessionStorage.removeItem(GREET_KEY); } catch { /* ignore */ }
    if (flag) start();
    return () => { try { recRef.current?.abort(); } catch { /* ignore */ } window.speechSynthesis?.cancel(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs]);

  function say(text, then) {
    setMsgs((m) => [...m, { from: 'ai', text }]);
    speak(text, then);
  }

  async function speak(text, then) {
    const synth = window.speechSynthesis;
    if (!synth || mutedRef.current) { then?.(); return; }
    // Stop anything still talking, then wait a beat: speaking straight after cancel() is silently dropped in Chrome.
    if (synth.speaking || synth.pending) { synth.cancel(); await new Promise((r) => setTimeout(r, 120)); }
    await whenVoicesReady();
    const v = pickVoice();
    const parts = sentences(String(text).replace(/₹\s?(\d+)/g, '$1 rupees').replace(/\bkm\b/g, 'kilometres'));
    let started = false, finished = false;
    const done = () => { if (finished) return; finished = true; setSpeaking(false); then?.(); };
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      if (v) u.voice = v;
      u.lang = v?.lang || 'en-IN'; u.rate = 1; u.pitch = 1.05; u.volume = 1;
      u.onstart = () => { started = true; setSoundBlocked(false); setSpeaking(true); };
      if (i === parts.length - 1) { u.onend = done; u.onerror = done; }
      else u.onerror = done;
      synth.speak(u);
    });
    synth.resume?.(); // Chrome sometimes leaves the queue paused
    // If no sound started, Chrome is blocking speech until the user taps: show "Tap to hear me".
    setTimeout(() => { if (!started) { setSoundBlocked(true); done(); } }, 3500);
  }

  function replayLast() {
    const last = [...msgs].reverse().find((m) => m.from === 'ai');
    setSoundBlocked(false);
    if (last) speak(last.text, ['ask-place', 'ask-reserve', 'ask-pay', 'ask-navigate'].includes(stageRef.current) ? listen : undefined);
  }

  function listen() {
    if (!Recognition || listening) return;
    try { recRef.current?.abort(); } catch { /* ignore */ }
    const r = new Recognition();
    r.lang = 'en-IN'; r.interimResults = false; r.maxAlternatives = 1; r.continuous = false;
    r.onresult = (e) => { const t = e.results?.[0]?.[0]?.transcript; if (t) { retryRef.current = 0; handle(t); } };
    r.onerror = (e) => {
      setListening(false);
      // Hands-free: if nobody spoke, listen once more before giving up.
      if (e.error === 'no-speech' && retryRef.current < 1) { retryRef.current += 1; setTimeout(listen, 300); return; }
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') showToast?.('Microphone blocked — type your answer instead, or allow the mic in the address bar.');
    };
    r.onend = () => setListening(false);
    recRef.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  }

  function start() {
    setOpen(true); setMsgs([]); setOffer(null); setHeld(null); setStage('ask-place');
    say(`Good ${partOfDay()}, ${first}! Where would you like to go today?`, listen);
  }

  async function handle(raw) {
    const text = String(raw || '').trim();
    if (!text) return;
    setMsgs((m) => [...m, { from: 'me', text }]);
    if (TAKEN.test(text)) {
      if (heldRef.current) return say(`Your slot ${heldRef.current.slotNumber} is in the reserved block, which is kept clear for bookings, so nobody else can park there. If anything is wrong when you arrive, the attendant at the gate will sort it out.`);
      return reportTaken();
    }
    const st = stageRef.current;
    const lotName = offerRef.current?.lot?.name ?? 'the lot';
    if (st === 'ask-reserve') {
      if (isYes(text)) return reserve();
      if (isNo(text)) { setStage('ask-navigate'); return say(`No problem. Shall I start navigation to ${lotName} anyway?`, listen); }
      // Anything else: treat it as a new destination.
    }
    if (st === 'ask-pay') {
      const app = upiFrom(text);
      if (app || isYes(text)) return pay(app || 'Google Pay');
      if (isNo(text)) { setStage('ask-navigate'); return say(`Okay, you can pay at the gate within 30 minutes. Shall I start navigation to ${lotName}?`, listen); }
      return say('Should I pay with Google Pay, PhonePe, Paytm or BHIM? Or say no to pay later.', listen);
    }
    if (st === 'ask-navigate') {
      if (isYes(text)) return navigate();
      if (isNo(text)) { setStage('done'); return say(`Alright. ${heldRef.current ? `Slot ${heldRef.current.slotNumber} is waiting for you. ` : ''}Drive safe!`); }
    }
    return findPlace(text);
  }

  async function findPlace(text) {
    setBusy(true);
    try {
      const q = placeFrom(text) || text;
      let r = await api('GET', `/search?q=${encodeURIComponent(q)}`);
      if (!r.place && q !== text) r = await api('GET', `/search?q=${encodeURIComponent(text)}`);
      if (!r.place) { setStage('ask-place'); return say("Sorry, I couldn't find that place. Try a sector, like Sector 17, or a place like Elante or Sukhna Lake.", listen); }
      const open = (r.lots ?? []).filter((l) => l.stats?.open);
      const total = open.reduce((a, l) => a + (l.stats?.available ?? 0), 0);
      if (!open.length) { setStage('ask-place'); return say(`The parking near ${r.place.label} is closed at this hour. Where else would you like to go?`, listen); }
      if (total === 0) { setStage('ask-place'); return say(`Parking near ${r.place.label} is full right now. Want to try somewhere nearby?`, listen); }
      const reservable = open.filter((l) => (l.stats?.reservableFree ?? 0) > 0);
      const lot = reservable[0] || open.find((l) => l.stats.available > 0);
      const dist = lot.distanceKm < 1 ? `${Math.round(lot.distanceKm * 1000)} metres` : `${lot.distanceKm.toFixed(1)} kilometres`;
      setOffer({ lot, place: r.place });
      const intro = `${r.place.label}, great choice for a lovely ${partOfDay()} out!`;
      const spaces = `There are ${total} free parking spaces around there right now.`;
      const fc = await arrivalForecast(lot);
      if (reservable.length) {
        setStage('ask-reserve');
        const advice = fc.verdict === 'tight' || fc.verdict === 'unlikely' ? ' I would reserve now so you are not left circling.' : '';
        return say(`${intro} ${spaces} The closest is ${lot.name}, ${dist} away, with ${lot.stats.available} free. ${fc.text}${advice} Do you want me to reserve a spot there for ${inr(lot.feeInr)}? It's held for 30 minutes.`, listen);
      }
      setStage('ask-navigate');
      return say(`${intro} ${spaces} ${lot.name} has ${lot.stats.available} walk-in spaces, but no reservable spots left, so just drive in. ${fc.text} Shall I start navigation?`, listen);
    } catch (e) {
      setStage('ask-place');
      say(e.code === 'offline' ? "I can't reach the Park'd server right now. Give it a few seconds and try again." : `Sorry, something went wrong: ${e.message}`, listen);
    } finally { setBusy(false); }
  }

  async function reserve() {
    const lot = offerRef.current?.lot;
    if (!lot) return;
    setBusy(true);
    try {
      const { reservation } = await api('POST', '/reservations', { lotId: lot._id });
      const where = await bayDirections(lot._id, reservation.slotNumber);
      setHeld(reservation); setStage('ask-pay'); onChanged?.();
      say(`Done! I've held slot ${reservation.slotNumber} at ${lot.name} for 30 minutes.${where} Shall I pay ${inr(reservation.feeInr)} with Google Pay?`, listen);
    } catch (e) {
      setStage('done');
      say(`I couldn't reserve that: ${e.message}`);
    } finally { setBusy(false); }
  }

  async function pay(app) {
    const h = heldRef.current;
    if (!h) return;
    setBusy(true);
    try {
      await api('POST', `/reservations/${h._id}/pay`, { upiApp: app });
      setHeld({ ...h, status: 'held', paid: true }); setStage('ask-navigate'); onChanged?.();
      say(`Paid with ${app}. Slot ${h.slotNumber} is yours. Shall I start navigation?`, listen);
    } catch (e) { say(`Payment didn't go through: ${e.message}`); }
    finally { setBusy(false); }
  }

  // "Someone is already parked in my slot": move to the next free slot, alert the attendant.
  async function reportTaken() {
    setBusy(true);
    try {
      const r = await api('POST', '/me/report-slot-taken');
      onChanged?.();
      if (r.moved) {
        if (heldRef.current) setHeld({ ...heldRef.current, slotNumber: r.slotNumber });
        const where = await bayDirections(r.lotId, r.slotNumber);
        setStage('done');
        say(`Sorry about that! I've notified the worker to check ${r.oldSlotNumber}, and moved you to bay ${r.slotNumber}.${where}`);
      } else {
        let alt = null;
        try { const a = await api('GET', `/lots/${encodeURIComponent(r.lotId)}/alternatives`); alt = a.suggestions?.find((x) => x.stats?.available > 0) ?? null; } catch { /* ignore */ }
        if (alt) {
          setOffer({ lot: alt, place: { label: alt.name } }); setStage('ask-navigate');
          say(`I've notified the worker at ${r.lotName}. It has no other free bay, but ${alt.name} is ${alt.distanceKm} kilometres away with ${alt.stats.available} free. Shall I start navigation there?`, listen);
        } else {
          setStage('ask-place');
          say(`I've notified the worker at ${r.lotName}. It has no other free bay and nothing nearby has space. Where else would you like to go?`, listen);
        }
      }
    } catch (e) {
      say(e.code === 'invalid-state' ? "You don't have a reserved or assigned slot right now. Where would you like to go?" : `I couldn't report that: ${e.message}`, listen);
    } finally { setBusy(false); }
  }

  // Opens Google Maps turn-by-turn (on a phone this opens the Maps app).
  function navigate() {
    const lot = offerRef.current?.lot;
    if (!lot) return;
    setStage('done');
    const url = directionsUrl(lot.lat, lot.lng, 'driving');
    say(`Opening Google Maps to ${lot.name}. Drive safe!`, () => {
      const w = window.open(url, '_blank');
      if (w) w.opener = null;
      else window.location.assign(url); // pop-ups blocked after a voice reply: open in this tab
    });
  }

  const submitTyped = (e) => { e.preventDefault(); const t = typed; setTyped(''); handle(t); };
  const lot = offer?.lot;

  if (!open) return <RobotLauncher firstName={first} onOpen={start} />;

  return (
    <div className="fixed z-[55] bottom-0 right-0 sm:bottom-5 sm:right-5 w-full sm:w-[380px] max-h-[80vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-sky-950/20 border border-sky-100 overflow-hidden" role="dialog" aria-label="Park'd voice assistant">
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-sky-600 to-sky-500 text-white">
        <span className="relative w-11 h-12 -my-1 flex items-center justify-center bg-white/15 rounded-2xl">
          <Robot size={38} talking={speaking} listening={listening} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black leading-tight">Park'd Assistant</p>
          <p className="text-[11px] text-sky-100">{listening ? 'Listening…' : speaking ? 'Speaking…' : busy ? 'Checking live parking…' : 'Ask me where you want to park'}</p>
        </div>
        <button type="button" onClick={() => { const next = !muted; setMuted(next); mutedRef.current = next; window.speechSynthesis?.cancel(); if (!next) replayLast(); }} className="p-1.5 rounded-lg hover:bg-white/15" aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button type="button" onClick={() => { setOpen(false); window.speechSynthesis?.cancel(); try { recRef.current?.abort(); } catch { /* ignore */ } }} className="p-1.5 rounded-lg hover:bg-white/15" aria-label="Close assistant">
          <X className="w-4 h-4" />
        </button>
      </div>

      {soundBlocked && !muted && (
        <button type="button" onClick={replayLast} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-100 text-amber-900 text-xs font-bold border-b border-amber-200 hover:bg-amber-200">
          <Volume2 className="w-4 h-4" /> Your browser blocked the sound — tap here to hear me
        </button>
      )}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-sky-50/40 min-h-[140px]">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <p onClick={m.from === 'ai' ? () => speak(m.text) : undefined} title={m.from === 'ai' ? 'Tap to hear again' : undefined}
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${m.from === 'me' ? 'bg-sky-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md cursor-pointer'}`}>{m.text}</p>
          </div>
        ))}
      </div>

      {(lot || held) && (
        <div className="px-4 py-3 border-t border-slate-100 space-y-2">
          {(stage === 'ask-reserve' || stage === 'ask-navigate') && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => handle('yes')} className="py-2 rounded-full bg-sky-600 text-white text-xs font-bold disabled:opacity-50">{stage === 'ask-reserve' ? 'Yes, reserve' : 'Yes, navigate'}</button>
              <button type="button" disabled={busy} onClick={() => handle('no')} className="py-2 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">No thanks</button>
            </div>
          )}
          {held && (
            <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
              <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200">Slot {held.slotNumber} · <HoldTimer to={held.expiresAt} /></span>
            </div>
          )}
          {held && !held.paid && stage === 'ask-pay' && (
            <div className="grid grid-cols-2 gap-2">
              {UPI_APPS.map((a) => <button key={a} type="button" disabled={busy} onClick={() => pay(a)} className="py-2 rounded-full border border-sky-200 text-sky-800 text-xs font-bold hover:bg-sky-50 disabled:opacity-50">Pay {inr(held.feeInr)} · {a}</button>)}
            </div>
          )}
          {lot && (
            <a href={directionsUrl(lot.lat, lot.lng, 'driving')} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-full bg-slate-900 text-white text-xs font-bold">
              <Navigation className="w-3.5 h-3.5" /> Drive there · {lot.name}
            </a>
          )}
        </div>
      )}

      <form onSubmit={submitTyped} className="flex items-center gap-2 px-3 py-3 border-t border-slate-100 bg-white">
        {Recognition ? (
          <button type="button" onClick={listening ? () => recRef.current?.stop() : listen}
            className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${listening ? 'bg-rose-500 text-white animate-pulse' : 'bg-sky-100 text-sky-700 hover:bg-sky-200'}`}
            aria-label={listening ? 'Stop listening' : 'Speak'}>
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        ) : null}
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={stage === 'ask-place' || stage === 'idle' || stage === 'done' ? 'Say or type a place, e.g. Sector 17' : stage === 'ask-pay' ? 'Say "yes", "PhonePe"… or "no"' : 'Say or type yes / no'}
          className="flex-1 min-w-0 px-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-400/50" />
        <button type="submit" disabled={!typed.trim() || busy} className="w-10 h-10 shrink-0 rounded-full bg-sky-600 text-white flex items-center justify-center disabled:opacity-40" aria-label="Send">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
