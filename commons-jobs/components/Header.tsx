
import React from 'react';
import { Plus, Hexagon } from 'lucide-react';

interface HeaderProps {
  currentView: 'browse' | 'submit';
  setCurrentView: (view: 'browse' | 'submit') => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView }) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" 
          onClick={() => setCurrentView('browse')}
          aria-label="Go to browse jobs"
        >
          <div className="bg-gray-900 text-white p-1.5 rounded-lg group-hover:bg-blue-600 transition-colors">
             <Hexagon size={20} strokeWidth={2.5} fill="currentColor" className="text-white/20" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gray-900 tracking-tight leading-none">
                Commons Jobs
            </span>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
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
                ? 'bg-gray-900 text-white border-gray-900 shadow-sm' 
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            Browse
          </button>
          
          <button
            type="button"
            onClick={() => setCurrentView('submit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
              currentView === 'submit' 
                ? 'bg-gray-900 text-white border-gray-900 shadow-sm' 
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Plus size={16} strokeWidth={3} className={currentView === 'submit' ? 'text-blue-400' : 'text-blue-600'} />
            <span>Post Role</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
