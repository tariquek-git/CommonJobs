import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface FAQProps {
  onBack: () => void;
}

const FAQ: React.FC<FAQProps> = ({ onBack }) => {
  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 md:p-12 animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-8 tracking-tight">FAQ</h1>

      <div className="text-gray-700 leading-relaxed text-sm md:text-base">
        <p>No FAQ needed. You've been on the internet long enough to figure this out.</p>
      </div>
    </div>
  );
};

export default FAQ;
