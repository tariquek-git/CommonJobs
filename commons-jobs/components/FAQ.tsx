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

      <div className="space-y-6 text-gray-700 leading-relaxed text-sm md:text-base">
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-2">What is Commons Jobs?</h2>
          <p>
            Commons Jobs is a community-first fintech and banking job board. It blends verified community
            submissions with a broader market feed.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-2">How long does moderation take?</h2>
          <p>
            New direct submissions are usually reviewed within 24 hours. During higher volume periods, review can
            take up to 48 hours.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Can I edit or remove a posting?</h2>
          <p>
            Yes. Email the admin contact in the footer with the job URL or reference ID and requested changes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-2">What content is not allowed?</h2>
          <p>
            Scams, misleading compensation claims, fake application links, and unrelated promotions are removed.
            Repeat abuse can result in permanent blocking.
          </p>
        </section>
      </div>
    </div>
  );
};

export default FAQ;
