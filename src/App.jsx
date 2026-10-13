import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import VerticalNav from './components/VerticalNav';
import HeroSection from './components/HeroSection';
import FindSlotSection from './components/FindSlotSection';
import SolutionSection from './components/SolutionSection';
import Footer from './components/Footer';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import { api, resetSocket, session } from './lib/api';

const LANDING_TABS = ['tab-overview', 'tab-problem', 'tab-solution'];
const TAB_SPY_OFFSET = 80;

function tabFromScrollPosition() {
  const sections = LANDING_TABS.map((id) => document.getElementById(id)).filter(Boolean);
  if (!sections.length) return LANDING_TABS[0];

  // Last section often cannot reach the top of the viewport. If the page is
  // at the bottom and that section is on screen, keep "What Park'd Does" active.
  const last = sections[sections.length - 1];
  const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 32;
  if (atEnd && last.getBoundingClientRect().top <= window.innerHeight * 0.55) {
    return last.id;
  }

  let active = sections[0].id;
  for (const el of sections) {
    if (el.getBoundingClientRect().top <= TAB_SPY_OFFSET) active = el.id;
  }
  return active;
}

export default function App() {
  // A saved sign-in (token in localStorage) reopens the dashboard after a refresh.
  const saved = session.get();
  const [currentView, setCurrentView] = useState(saved?.token ? 'dashboard' : 'landing'); // 'landing' | 'auth' | 'dashboard'
  const [currentUser, setCurrentUser] = useState(saved);

  // Refresh the saved user (and drop an expired token) once on load.
  useEffect(() => {
    if (!saved?.token) return;
    api('GET', '/auth/me').then(({ user }) => {
      const s = { ...saved, user };
      session.set(s);
      setCurrentUser(s);
    }).catch((e) => {
      if (e.status === 401) { session.clear(); setCurrentUser(null); setCurrentView('auth'); }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeTab, setActiveTab] = useState('tab-overview');
  const clickLockRef = useRef(false);
  const clickLockTimerRef = useRef(null);

  const handleOpenAuth = () => {
    setCurrentView('auth');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleReturnToLanding = () => {
    setCurrentView('landing');
  };

  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
    setCurrentView('dashboard');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleLogout = () => {
    session.clear();
    resetSocket();
    setCurrentUser(null);
    setCurrentView('landing');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const syncTabFromScroll = useCallback(() => {
    if (clickLockRef.current) return;
    const next = tabFromScrollPosition();
    setActiveTab((current) => (current === next ? current : next));
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', syncTabFromScroll, { passive: true });
    window.addEventListener('resize', syncTabFromScroll);
    syncTabFromScroll();
    return () => {
      window.removeEventListener('scroll', syncTabFromScroll);
      window.removeEventListener('resize', syncTabFromScroll);
      if (clickLockTimerRef.current) clearTimeout(clickLockTimerRef.current);
    };
  }, [syncTabFromScroll]);

  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
    clickLockRef.current = true;
    if (clickLockTimerRef.current) clearTimeout(clickLockTimerRef.current);

    const unlock = () => {
      if (!clickLockRef.current) return;
      clickLockRef.current = false;
      if (clickLockTimerRef.current) {
        clearTimeout(clickLockTimerRef.current);
        clickLockTimerRef.current = null;
      }
      window.removeEventListener('scrollend', unlock);
      setActiveTab(tabFromScrollPosition());
    };

    window.addEventListener('scrollend', unlock, { once: true });

    const startedAt = Date.now();
    let lastY = window.scrollY;
    const waitUntilSettled = () => {
      if (!clickLockRef.current) return;
      const idle = Math.abs(window.scrollY - lastY) < 1;
      lastY = window.scrollY;
      if (idle && Date.now() - startedAt > 400) {
        unlock();
        return;
      }
      clickLockTimerRef.current = setTimeout(waitUntilSettled, 100);
    };
    clickLockTimerRef.current = setTimeout(waitUntilSettled, 100);

    const targetEl = document.getElementById(tabId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (currentView === 'dashboard') {
    return <Dashboard user={currentUser} onLogout={handleLogout} />;
  }

  if (currentView === 'auth') {
    return <AuthPage onReturn={handleReturnToLanding} onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="relative min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Navigation Bar */}
      <Header onTabSelect={handleTabSelect} activeTab={activeTab} onOpenAuth={handleOpenAuth} />

      {/* Vertical Traffic (Red) to Flow (Blue) Slider on the Left */}
      <VerticalNav activeTab={activeTab} onTabSelect={handleTabSelect} />

      {/* Main Content Sections */}
      <main className="flex-1 flex flex-col">
        {/* Tab 01: Overview & Hero */}
        <HeroSection onTabSelect={handleTabSelect} onOpenAuth={handleOpenAuth} />

        {/* Tab 02: Find a Slot (Split: TextType on Left, Interactive Driver App on Right) */}
        <FindSlotSection onTabSelect={handleTabSelect} onOpenAuth={handleOpenAuth} />

        {/* Tab 03: What Park'd Does (3 apps, simulation, flows, why it matters) */}
        <SolutionSection onTabSelect={handleTabSelect} onOpenAuth={handleOpenAuth} />
      </main>

      {/* Footer */}
      <Footer onTabSelect={handleTabSelect} />
    </div>
  );
}
