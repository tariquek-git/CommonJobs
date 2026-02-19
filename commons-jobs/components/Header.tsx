
import React from 'react';
import { Plus, Hexagon } from 'lucide-react';

interface HeaderProps {
  currentView: 'browse' | 'submit';
  setCurrentView: (view: 'browse' | 'submit') => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView }) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b border-[#d9e5e6]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4B6] focus-visible:ring-offset-2"
          onClick={() => setCurrentView('browse')}
        >
          <div className="relative w-12 h-12 rounded-xl bg-[#0B132B] border border-[#1e2c4a] shadow-[0_10px_25px_rgba(11,19,43,0.28)] flex items-center justify-center transition-transform group-hover:scale-105">
             <Hexagon size={26} strokeWidth={2.3} className="text-[#2EC4B6]" />
             <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-[#2EC4B6] border-2 border-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-[#0B132B] tracking-tight leading-none">
                Commons Jobs
            </span>
            <span className="text-[11px] font-semibold text-[#4b5a77] uppercase tracking-wider">
                By Fintech Commons
            </span>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentView('browse')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
              currentView === 'browse' 
                ? 'bg-[#0B132B] text-white border-[#0B132B] shadow-[0_6px_16px_rgba(11,19,43,0.28)]'
                : 'bg-white text-[#0B132B] border-[#d8e4e6] hover:border-[#9adfd8] hover:bg-[#f5fbfb]'
            }`}
          >
            Browse
          </button>
          
          <button
            type="button"
            onClick={() => setCurrentView('submit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
              currentView === 'submit' 
                ? 'bg-[#2EC4B6] text-[#0B132B] border-[#2EC4B6] shadow-[0_8px_20px_rgba(46,196,182,0.3)]'
                : 'bg-white text-[#0B132B] border-[#d8e4e6] hover:border-[#9adfd8] hover:bg-[#f5fbfb]'
            }`}
          >
            <Plus size={16} strokeWidth={3} className={currentView === 'submit' ? 'text-[#0B132B]' : 'text-[#0f766e]'} />
            <span>Post Role</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
