import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { CONTACT_EMAIL } from '../siteConfig';

interface PageProps {
  onBack: () => void;
}

const DataTerms: React.FC<PageProps> = ({ onBack }) => {
  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 md:p-12 animate-fade-in">
      <button 
        type="button"
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-8 tracking-tight">Data, Terms, and Common Sense</h1>

      <div className="space-y-8 text-gray-700 leading-relaxed text-sm md:text-base">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">The quick version</h2>
          <p>
            This is a hobby project built for the Fintech Commons community. It’s meant to be useful, not perfect. Use it at your own discretion.
          </p>
          <p className="mt-2">
            If you are not comfortable sharing something, then don’t. If a form ever asks for something that feels unnecessary, skip it or email me if you have questions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">What I collect</h2>
          <p className="mb-2">In plain English (sorry, Québec):</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Name so I know who submitted it</li>
            <li>Email so I can contact you if something needs clarification, or if you want an edit or takedown</li>
            <li>Whatever you submit in the form (job details, links, descriptions, tags)</li>
            <li>Basic analytics like page views, clicks, and general traffic patterns so I can understand what’s useful and improve the tool</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">What I do not collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>No passwords or logins</li>
            <li>No payment info. If this ever becomes a paid thing, it’ll be obvious, opt in, and you’ll hear about it. I’m not quietly turning this into a fintech subscription trap.</li>
            <li>No government ID</li>
            <li>No sensitive personal info unless you choose to type it in (please don’t)</li>
            <li>No trying to follow you around the internet</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Common sense rules</h2>
          <p>External links are outside my control. Use your judgment before clicking or applying.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Acceptable use</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>No scam or deceptive listings</li>
            <li>No phishing links or data-harvesting forms</li>
            <li>No unrelated promotions or spam submissions</li>
            <li>No impersonation of companies, teams, or recruiters</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">How I use your info</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To publish your submission on the board</li>
            <li>To moderate spam or submissions that do not fit the vibe</li>
            <li>To improve the site using basic usage stats</li>
            <li>To contact you if something needs clarification or if you ask for a change</li>
            <li>I may also lightly edit for clarity or formatting so the board stays readable. I will not rewrite your intent.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Sharing and privacy</h2>
          <p>I am not selling your data. I am not sharing your email. I am not building a marketing list and checking it twice.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">No logins means manual edits</h2>
          <p>Because there are no accounts, you cannot log in later to edit your post.</p>
          <p className="mt-2">
            If you need an edit or want something removed, email me at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-700 underline underline-offset-2 hover:text-blue-800">
              {CONTACT_EMAIL}
            </a>{' '}
            and I’ll handle it manually.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Accuracy and safety</h2>
          <p>I can’t verify every listing, link, or claim. Use your common sense and discretion before you apply, click, share anything sensitive, or treat something as factual.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">The hobby clause</h2>
          <p>This is provided as is. If it’s buggy or goes offline, don’t panic. I’ll fix it when I can.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Community vibes</h2>
          <p>Keep submissions helpful and relevant. I reserve the right to remove anything that is spammy, misleading, or off topic.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Questions, edits, or takedowns</h2>
          <p>
            Email me at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-700 underline underline-offset-2 hover:text-blue-800">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
};

export default DataTerms;
