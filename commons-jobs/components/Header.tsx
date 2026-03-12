
import React from 'react';
import { Plus, Hexagon } from 'lucide-react';

interface HeaderProps {
  currentView: 'browse' | 'submit';
  setCurrentView: (view: 'browse' | 'submit') => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--cj-stroke-soft)] bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[5.5rem] max-w-[1680px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          className="group flex items-center gap-3 rounded-2xl transition-premium focus-visible:focus-ring"
          onClick={() => setCurrentView('browse')}
        >
          <div className="relative flex h-14 w-14 items-center justify-center rounded-[18px] border border-[#1f2d48] bg-[linear-gradient(145deg,#0a1630,#112654)] shadow-[0_12px_28px_rgba(10,22,48,0.34)]">
            <Hexagon size={26} strokeWidth={2.25} className="text-[var(--cj-accent)]" />
            <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-[var(--cj-accent)]" />
            <span className="absolute inset-0 rounded-[18px] ring-1 ring-inset ring-white/12" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[1.42rem] font-semibold leading-none tracking-[-0.015em] text-[var(--cj-text-primary)]">
              Commons Jobs
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cj-text-secondary)]">By Fintech Commons</span>
              <span className="rounded-full border border-[#c9efe9] bg-[#ecfaf7] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#116d63]">
                Beta
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentView('browse')}
            className={`rounded-[13px] border px-4 py-2 text-sm font-semibold transition-premium focus-visible:focus-ring ${
              currentView === 'browse' 
                ? 'border-[var(--cj-accent-navy)] bg-[var(--cj-accent-navy)] text-white shadow-[0_6px_16px_rgba(11,19,43,0.2)]'
                : 'border-[var(--cj-stroke-soft)] bg-white/85 text-[var(--cj-text-primary)] hover:border-[var(--cj-stroke-strong)]'
            }`}
          >
            Browse
          </button>
          
          <button
            type="button"
            onClick={() => setCurrentView('submit')}
            className={`flex items-center gap-2 rounded-[13px] border px-4 py-2 text-sm font-semibold transition-premium focus-visible:focus-ring ${
              currentView === 'submit' 
                ? 'border-[var(--cj-accent)] bg-[var(--cj-accent)] text-[var(--cj-accent-navy)] shadow-[0_8px_20px_rgba(42,184,170,0.24)]'
                : 'border-[var(--cj-stroke-soft)] bg-white/85 text-[var(--cj-text-primary)] hover:border-[var(--cj-stroke-strong)]'
            }`}
          >
            <Plus size={16} strokeWidth={2.8} className={currentView === 'submit' ? 'text-[var(--cj-accent-navy)]' : 'text-[var(--cj-accent-strong)]'} />
            <span>Post Role</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
