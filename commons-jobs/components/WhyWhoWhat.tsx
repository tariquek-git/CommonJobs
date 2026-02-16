import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  onBack: () => void;
}

const WhyWhoWhat: React.FC<PageProps> = ({ onBack }) => {
  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 md:p-12 animate-fade-in">
      <button 
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-8 tracking-tight">Why, Who, & What</h1>

      <div className="space-y-10 text-gray-700 leading-relaxed text-sm md:text-base">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Why I’m Building This</h2>
          <p>
            Fintech Commons is a hobby project I’m building to stay curious and keep learning as tech shifts in banking and fintech.
          </p>
          <p className="mt-2">
            I’m not a developer and I’m not trying to compete with real products. This is my sandbox to learn by building, understand how modern tools actually work, and develop more empathy for the people who ship the real stuff.
          </p>
          <p className="mt-2">
            Some things here will be rough around the edges. Use your common sense and discretion. If you spot something broken or have a feature idea, tell me.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">About Me</h2>
          <p>
            I’m Tarique. I’ve been in the fintech space since 2017, mostly on the B2B side working with banks, credit unions, fintechs, and large enterprises across Canada and the US to help them serve their customers, consumer and business.
          </p>
          <p className="mt-2">
            Some people collect stamps. I collect side projects.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">What I Do Now</h2>
          <p>
            I work at Brim Financial. Brim is the platform banks, credit unions, fintechs, and brands use to launch modern card and payment products.
          </p>
          <p className="mt-2">
            If you want to chat about modernizing cards and payments, hit me up.
          </p>
          <p className="mt-2 font-medium">
            Connect on LinkedIn: <a href="#" className="text-blue-600 hover:underline">[LINKEDIN URL HERE]</a>
          </p>
        </section>
      </div>
    </div>
  );
};

export default WhyWhoWhat;