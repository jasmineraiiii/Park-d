import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import VerticalNav from './components/VerticalNav';
import HeroSection from './components/HeroSection';
import FindSlotSection from './components/FindSlotSection';
import SolutionSection from './components/SolutionSection';
import Footer from './components/Footer';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import { api, resetSocket, session } from './lib/api';

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

  // Use IntersectionObserver — fires exactly when a section enters the viewport,
  // no scroll polling, no RAF loop, no unnecessary re-renders.
  useEffect(() => {
    const sectionIds = ['tab-overview', 'tab-problem', 'tab-solution'];

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the section with the highest intersectionRatio that is visible
        let best = null;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!best || entry.intersectionRatio > best.intersectionRatio) {
              best = entry;
            }
          }
        });
        if (best) {
          setActiveTab((current) =>
            current === best.target.id ? current : best.target.id
          );
        }
      },
      {
        threshold: [0, 0.15, 0.35, 0.5, 0.75, 1],
        rootMargin: '0px 0px -30% 0px',
      }
    );

    const tid = setTimeout(() => {
      sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 100);

    return () => {
      clearTimeout(tid);
      observer.disconnect();
    };
  }, []);

  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
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
