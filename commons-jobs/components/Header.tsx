
import React from 'react';
import { Plus, Hexagon } from 'lucide-react';

interface HeaderProps {
  currentView: 'browse' | 'submit';
  setCurrentView: (view: 'browse' | 'submit') => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--cj-stroke-soft)] bg-white/88 backdrop-blur-xl">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <button
          type="button"
          className="group flex items-center gap-3 rounded-xl transition-premium focus-visible:focus-ring"
          onClick={() => setCurrentView('browse')}
        >
          <div className="relative flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#1f2d48] bg-[var(--cj-accent-navy)] shadow-[0_10px_24px_rgba(11,19,43,0.24)]">
             <Hexagon size={24} strokeWidth={2.3} className="text-[var(--cj-accent)]" />
             <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-[#2EC4B6] border-2 border-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[1.36rem] font-semibold leading-none tracking-[-0.01em] text-[var(--cj-text-primary)]">
                Commons Jobs
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cj-text-secondary)]">
                By Fintech Commons
            </span>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentView('browse')}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-premium focus-visible:focus-ring ${
              currentView === 'browse' 
                ? 'border-[var(--cj-accent-navy)] bg-[var(--cj-accent-navy)] text-white shadow-[0_6px_16px_rgba(11,19,43,0.2)]'
                : 'border-[var(--cj-stroke-soft)] bg-white text-[var(--cj-text-primary)] hover:border-[var(--cj-stroke-strong)]'
            }`}
          >
            Browse
          </button>
          
          <button
            type="button"
            onClick={() => setCurrentView('submit')}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-premium focus-visible:focus-ring ${
              currentView === 'submit' 
                ? 'border-[var(--cj-accent)] bg-[var(--cj-accent)] text-[var(--cj-accent-navy)] shadow-[0_8px_20px_rgba(42,184,170,0.24)]'
                : 'border-[var(--cj-stroke-soft)] bg-white text-[var(--cj-text-primary)] hover:border-[var(--cj-stroke-strong)]'
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
