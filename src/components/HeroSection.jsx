import React from 'react';
import Grainient from './Grainient';
import { ChevronRight, ArrowDown } from 'lucide-react';

export default function HeroSection({ onTabSelect, onOpenAuth }) {
  return (
    <section
      id="tab-overview"
      className="relative min-h-[92vh] flex items-center justify-center pt-24 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden bg-sky-50/50 transition-opacity duration-700 ease-out"
    >
      {/* Interactive, Silky, and Flowing Grainient Backdrop */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-auto">
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
          className="absolute inset-0 w-full h-full"
        />
        {/* Soft edge gradients blending smoothly with navbar and lower section */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/80 via-white/40 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white via-white/50 to-transparent pointer-events-none" />
      </div>

      {/* Foreground Hero Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
        {/* Badge */}
        <div className="animate-fade-in delay-100 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 border border-sky-200 shadow-sm backdrop-blur-md text-xs text-sky-800 font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
          <span>Chandigarh Municipal Corporation</span>
          <span className="text-sky-300">•</span>
          <span className="text-slate-600">Smart Parking Network</span>
        </div>

        {/* Main Title */}
        <h1 className="animate-fade-in delay-200 text-5xl sm:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 leading-[1.08]">
          Your spot.
          <span className="block text-sky-600">Before you start.</span>
        </h1>

        {/* Subtitle */}
        <p className="animate-fade-in delay-300 text-lg sm:text-2xl text-slate-700 max-w-2xl font-normal leading-relaxed mb-10">
          Park'd puts every Municipal Corporation parking lot in Chandigarh on one live map, so citizens know where to park before they leave home.
        </p>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 w-full max-w-xl mb-10">
          <div className="animate-fade-in-scale delay-400 p-3.5 sm:p-4 rounded-2xl bg-white/90 border border-sky-100 shadow-sm backdrop-blur-md text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-sky-600">₹14</div>
            <div className="text-xs text-slate-600 font-semibold mt-0.5">Flat Municipal Fee</div>
          </div>

          <div className="animate-fade-in-scale delay-500 p-3.5 sm:p-4 rounded-2xl bg-white/90 border border-sky-100 shadow-sm backdrop-blur-md text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-sky-600">0</div>
            <div className="text-xs text-slate-600 font-semibold mt-0.5">Sensors or Cameras</div>
          </div>

          <div className="col-span-2 sm:col-span-1 animate-fade-in-scale delay-600 p-3.5 sm:p-4 rounded-2xl bg-white/90 border border-sky-100 shadow-sm backdrop-blur-md text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-sky-600">15 min</div>
            <div className="text-xs text-slate-600 font-semibold mt-0.5">Guaranteed Lock</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="animate-fade-in delay-700 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => (onOpenAuth ? onOpenAuth() : onTabSelect('tab-solution'))}
            className="px-8 py-3.5 rounded-full bg-slate-100/90 hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-200/90 shadow-sm backdrop-blur-md transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer flex items-center gap-2 hover:border-slate-300"
          >
            <span>Get Started</span>
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>

          <button
            type="button"
            onClick={() => onTabSelect('tab-problem')}
            className="px-7 py-3.5 rounded-full bg-slate-100/90 hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-200/90 shadow-sm backdrop-blur-md transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer hover:border-slate-300"
          >
            Explore Platform
          </button>
        </div>

        {/* Scroll indicator */}
        <button
          type="button"
          onClick={() => onTabSelect('tab-problem')}
          className="animate-fade-in delay-800 mt-12 text-xs font-semibold text-slate-600 hover:text-sky-600 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>Scroll to explore</span>
          <ArrowDown className="w-3.5 h-3.5 animate-bounce text-sky-600" />
        </button>
      </div>
    </section>
  );
}
