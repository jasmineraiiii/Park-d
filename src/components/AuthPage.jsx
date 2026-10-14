import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Car, Wrench, Terminal, ShieldCheck } from 'lucide-react';
import Grainient from './Grainient';
import { signIn, signInWithGoogle } from '../lib/api';

let googleScriptPromise;
let initializedGoogleClientId = null;
let activeGoogleCallback = null;
function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Google sign-in. Check your connection and try again.'));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

export default function AuthPage({ onReturn, onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(true);
  const [role, setRole] = useState('driver'); // 'driver' | 'worker' | 'developer'
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const googleButtonRef = useRef(null);
  const googleCallbackRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  googleCallbackRef.current = async (response) => {
    if (!response?.credential) { setError('Google sign-in did not return a credential. Please try again.'); return; }
    setError('');
    setBusy(true);
    try {
      const s = await signInWithGoogle(response.credential);
      onAuthSuccess?.({ ...s, fullName: s.user.name, email: s.user.email, govtPassId: s.user.username });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  activeGoogleCallback = googleCallbackRef.current;
  const isStaff = role !== 'driver'; // workers and MC staff have accounts issued by the MC: log in only
  const signUpMode = isSignUp && !isStaff;
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    govtPassId: ''
  });

  useEffect(() => {
    if (isStaff || !googleClientId) return undefined;
    let mounted = true;
    loadGoogleIdentityServices().then(() => {
      if (!mounted || !googleButtonRef.current) return;
      if (!initializedGoogleClientId) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          ux_mode: 'popup',
          callback: (response) => activeGoogleCallback?.(response),
        });
        initializedGoogleClientId = googleClientId;
      }
      googleButtonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with',
        logo_alignment: 'left', width: Math.min(400, googleButtonRef.current.clientWidth || 400),
      });
    }).catch((err) => { if (mounted) setError(err.message); });
    return () => { mounted = false; };
  }, [isStaff, googleClientId]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // Signs in against the Park'd backend: drivers with email + password,
  // workers / MC staff with their staff ID + PIN.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (signUpMode && formData.password !== formData.confirmPassword) { setError("Passwords don't match."); return; }
    setBusy(true);
    try {
      const s = await signIn({ role, isSignUp: signUpMode, fullName: formData.fullName, email: formData.email, password: formData.password, staffId: formData.govtPassId.trim() });
      onAuthSuccess?.({ ...s, fullName: s.user.name, email: s.user.email, govtPassId: s.user.username });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp((prev) => !prev);
    setError('');
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden font-sans select-none bg-sky-50/40">
      {/* Fullscreen Grainient Background (Light, Silky, and Flowing like Landing Page) */}
      <div className="fixed inset-0 z-0 pointer-events-auto">
        <Grainient
          colors={["#e0f2fe", "#0284c7", "#38bdf8", "#bae6fd", "#f0f9ff", "#ffffff"]}
          angle={25}
          flow={1.1}
          silk={0.78}
          grainAmount={0.008}
          grainSize={0.7}
          grainAnimated={true}
          speed={1.4}
          variation={1.2}
          contrast={0.82}
          saturation={1.05}
          interactive={true}
          stir={1.2}
          clickSwirl={true}
          intro={false}
          className="w-full h-full"
        />
        {/* Soft edge gradients */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/70 via-white/30 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/80 via-white/40 to-transparent pointer-events-none" />
      </div>

      {/* Top Left: Return to Landing Button (White Translucent Glass Pill) */}
      <div className="fixed top-5 left-5 sm:top-7 sm:left-7 z-30">
        <button
          type="button"
          onClick={onReturn}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 text-xs font-mono font-bold border border-sky-200/80 backdrop-blur-md shadow-md transition-all duration-200 cursor-pointer group hover:scale-[1.02]"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform text-sky-600" />
          <span>Return to Landing</span>
        </button>
      </div>

      {/* Centered White Translucent Glass Panel */}
      <div className="relative z-10 w-full max-w-[760px] bg-white/85 backdrop-blur-2xl border border-white/80 rounded-[32px] sm:rounded-[36px] p-7 sm:p-11 shadow-2xl shadow-sky-950/10 my-10 animate-fade-in">
        {/* Header Section — Park'd Branding */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-700">
              Chandigarh Municipal Corporation
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            {signUpMode ? 'Sign Up' : 'Log In'}
          </h2>
          <p className="font-mono text-xs sm:text-sm text-slate-500 mt-1 tracking-normal">
            Join Park'd Smart Parking Network
          </p>
        </div>

        {/* Role Selector (Developer / Worker / Citizen) above form inputs */}
        <div className="mb-6">
          <label className="block text-[11px] font-mono font-bold uppercase text-slate-500 mb-2">
            Select Your Role
          </label>
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setRole('driver')}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-mono text-xs font-bold transition-all cursor-pointer ${
                role === 'driver'
                  ? 'bg-white text-sky-700 shadow-sm border border-sky-100'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Car className="w-3.5 h-3.5 text-sky-600" />
              <span>Citizen</span>
            </button>

            <button
              type="button"
              onClick={() => setRole('worker')}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-mono text-xs font-bold transition-all cursor-pointer ${
                role === 'worker'
                  ? 'bg-white text-sky-700 shadow-sm border border-sky-100'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-amber-600" />
              <span>Worker</span>
            </button>

            <button
              type="button"
              onClick={() => setRole('developer')}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-mono text-xs font-bold transition-all cursor-pointer ${
                role === 'developer'
                  ? 'bg-white text-sky-700 shadow-sm border border-sky-100'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-purple-600" />
              <span>Developer</span>
            </button>
          </div>
        </div>

        {/* Two-Column Form Layout */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start">
          {/* Left Column: Input Fields */}
          <div className="flex flex-col gap-3">
            {signUpMode && (
              <input
                type="text"
                name="fullName"
                required
                placeholder="Full Name"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-5 py-3.5 rounded-full bg-slate-50/90 border border-slate-200/90 text-slate-900 placeholder:text-slate-400 font-medium text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 shadow-inner transition-all"
              />
            )}

            {!isStaff && <input
              type="email"
              name="email"
              required
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-5 py-3.5 rounded-full bg-slate-50/90 border border-slate-200/90 text-slate-900 placeholder:text-slate-400 font-medium text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 shadow-inner transition-all"
            />}

            {/* Staff ID required for Workers and Developers (issued by the MC) */}
            {(role === 'worker' || role === 'developer') && (
              <div className="relative">
                <input
                  type="text"
                  name="govtPassId"
                  required
                  placeholder={
                    role === 'worker'
                      ? 'Staff ID (e.g. att-17)'
                      : 'Staff ID (e.g. mc-admin)'
                  }
                  autoComplete="username"
                  value={formData.govtPassId}
                  onChange={handleChange}
                  className="w-full pl-5 pr-10 py-3.5 rounded-full bg-slate-50/90 border border-amber-300 text-slate-900 placeholder:text-slate-400 font-medium text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-inner transition-all"
                />
                <ShieldCheck className="w-4 h-4 text-amber-500 absolute right-4 top-1/2 -translate-y-1/2" />
              </div>
            )}

            <input
              type="password"
              name="password"
              required
              placeholder={isStaff ? '4-digit PIN' : 'Password'}
              inputMode={isStaff ? 'numeric' : undefined}
              autoComplete={signUpMode ? 'new-password' : 'current-password'}
              value={formData.password}
              onChange={handleChange}
              className="w-full px-5 py-3.5 rounded-full bg-slate-50/90 border border-slate-200/90 text-slate-900 placeholder:text-slate-400 font-medium text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 shadow-inner transition-all"
            />

            {signUpMode && (
              <input
                type="password"
                name="confirmPassword"
                required
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-5 py-3.5 rounded-full bg-slate-50/90 border border-slate-200/90 text-slate-900 placeholder:text-slate-400 font-medium text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 shadow-inner transition-all"
              />
            )}
          </div>

          {/* Right Column: Actions & Social Logins */}
          <div className="flex flex-col gap-3">
            {/* Primary Action Button — Signature Park'd Sky Blue with Glowing Aura */}
            {error && (
              <p role="alert" className="px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{error}</p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 rounded-full bg-sky-600 disabled:opacity-60 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm tracking-wide transition-all duration-200 cursor-pointer shadow-[0_0_24px_rgba(2,132,199,0.35)] hover:shadow-[0_0_32px_rgba(14,165,233,0.5)] transform hover:-translate-y-0.5"
            >
              {busy ? 'Please wait…' : signUpMode ? `Sign Up as ${role.toUpperCase()}` : `Log In as ${role.toUpperCase()}`}
            </button>

            {/* Toggle Mode Link */}
            {isStaff ? (
              <p className="text-xs text-slate-500 text-center font-normal my-1">
                Staff accounts are issued by the Municipal Corporation.
              </p>
            ) : (
            <p className="text-xs text-slate-500 text-center font-normal my-1">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-sky-600 hover:text-sky-700 font-bold underline underline-offset-2 transition-colors cursor-pointer ml-1"
              >
                {isSignUp ? 'Log in' : 'Sign Up'}
              </button>
            </p>
            )}

            {/* "Or" Divider */}
            <div className="relative flex items-center justify-center my-1.5">
              <div className="flex-grow border-t border-slate-200" />
              <span className="flex-shrink mx-3 text-[11px] font-mono text-slate-400">Or</span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            {/* Google sign-in */}
            {isStaff ? (
              <p className="text-xs text-slate-500 text-center">Google sign-in is for citizens. Use your staff ID and PIN.</p>
            ) : googleClientId ? (
              <div ref={googleButtonRef} className="min-h-12 w-full flex justify-center" aria-label="Continue with Google" />
            ) : (
              <p className="text-xs text-amber-700 text-center">Google sign-in needs VITE_GOOGLE_CLIENT_ID configured for the frontend.</p>
            )}

            <p className="text-[10px] font-mono text-slate-400 text-center leading-relaxed mt-1">
              Demo accounts — citizen: driver@demo.parkd / parkd-demo · host: host1@demo.parkd / parkd-demo<br />
              worker: att-17 / 1717 · MC (developer): mc-admin / 2026
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
