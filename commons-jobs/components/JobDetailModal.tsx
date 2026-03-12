
import React, { useEffect, useId, useRef, useState } from 'react';
import { JobPosting } from '../types';
import { trackClick } from '../services/jobService';
import { X, MapPin, Building2, Clock, ArrowUpRight, CheckCircle2, DollarSign, Briefcase, Zap, ShieldCheck, HeartHandshake } from 'lucide-react';
import { getPostedDateLabel } from '../utils/dateLabel';
import { getCompanyLogoUrl } from '../utils/companyLogo';
import { buildFeedbackMailto } from '../utils/feedbackMailto';
import { CONTACT_EMAIL } from '../siteConfig';

interface JobDetailModalProps {
  job: JobPosting;
  onClose: () => void;
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, onClose }) => {
  const [imgError, setImgError] = useState(false);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isDirect = job.sourceType === 'Direct';
  const introRequestHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `Intro request: ${job.roleTitle} @ ${job.companyName}`
  )}&body=${encodeURIComponent(
    `Hi,\n\nI would like an intro for this role.\n\nJob ID: ${job.id}\nRole: ${job.roleTitle}\nCompany: ${job.companyName}\nApply link: ${job.externalLink}\n\nThanks!`
  )}`;

  const getFocusableElements = (): HTMLElement[] => {
    if (!dialogRef.current) return [] as HTMLElement[];
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return Array.from(dialogRef.current.querySelectorAll(selectors)) as HTMLElement[];
  };

  useEffect(() => {
    // Prevent background scrolling when modal is open
    document.body.style.overflow = 'hidden';
    // Give keyboard users a deterministic starting point.
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeElement = document.activeElement as HTMLElement | null;
        const activeInsideDialog = activeElement ? dialogRef.current?.contains(activeElement) : false;

        if (event.shiftKey) {
          if (!activeInsideDialog || activeElement === first) {
            event.preventDefault();
            last.focus();
          }
          return;
        }

        if (!activeInsideDialog || activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const handleApply = () => {
    trackClick(job.id);
    let targetUrl = job.externalLink;
    
    if (targetUrl && !targetUrl.startsWith('http')) {
        targetUrl = `https://${targetUrl}`;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const logoUrl = getCompanyLogoUrl(job.companyWebsite, job.externalLink);

  return (
    <div className="fixed inset-0 z-[60] flex justify-center items-end md:items-center sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity animate-fade-in" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-2xl bg-white rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] md:max-h-[85vh] animate-slide-up overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-start gap-4 sticky top-0 bg-white z-10">
           <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 mt-1">
             <Building2 size={24} className="text-gray-300 absolute" />
             {!imgError && logoUrl && (
               <img 
                  src={logoUrl}
                  alt={`${job.companyName} logo`} 
                  className="w-full h-full object-contain relative z-10 bg-white"
                  onError={() => setImgError(true)}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
               />
             )}
           </div>
           
           <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                  <div>
                    <h2 id={titleId} className="text-xl md:text-2xl font-bold text-gray-900 leading-tight mb-1">{job.roleTitle}</h2>
                    <div className="flex items-center gap-2 text-gray-600 font-medium">
                        {job.companyName}
                        {job.isVerified && (
                             <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full border border-blue-100 font-bold uppercase tracking-wider">
                                <CheckCircle2 size={10} /> Verified
                             </span>
                        )}
                        {isDirect && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-[#eef7f6] text-[#0f766e] px-1.5 py-0.5 rounded-full border border-[#d7efec] font-bold uppercase tracking-wider">
                            <ShieldCheck size={10} /> Community reviewed
                          </span>
                        )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    ref={closeButtonRef}
                    className="text-gray-400 hover:text-gray-600 p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    aria-label="Close job details"
                  >
                      <X size={20} />
                  </button>
              </div>
           </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-gray-200">
            {isDirect && (
              <div className="rounded-xl border border-[#cdece8] bg-[#f4fbfa] p-4 text-sm text-[#0b5f58]">
                <div className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide">
                  <HeartHandshake size={12} />
                  Warm intro possible
                </div>
                <p className="mt-1 text-xs">
                  This role came through the community board. If you’re a fit, you can request an intro from Fintech Commons.
                </p>
              </div>
            )}
            
            {/* Metadata Grid */}
            <div className="flex flex-wrap gap-3">
                 {(job.locationCity || job.locationCountry) && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-sm font-medium text-gray-700">
                        <MapPin size={16} className="text-gray-400" />
                        {job.locationCity}{job.locationCity && job.locationCountry ? ', ' : ''}{job.locationCountry === 'United States' ? 'USA' : job.locationCountry}
                    </div>
                 )}
                 <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-sm font-medium text-gray-700">
                    <Briefcase size={16} className="text-gray-400" />
                    {job.employmentType} &bull; {job.remotePolicy}
                 </div>
                 {job.salaryRange && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-100 text-sm font-medium text-green-700">
                        <DollarSign size={16} />
                        {job.currency || 'USD'} {job.salaryRange}
                    </div>
                 )}
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-sm font-medium text-gray-700">
                    <Clock size={16} className="text-gray-400" />
                    Posted {getPostedDateLabel(job.postedDate)}
                 </div>
            </div>

            {/* Intelligence Section */}
            {job.intelligenceSummary && (
                <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100 space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-5">
                        <Zap size={100} />
                    </div>
                    <div className="flex items-center gap-2 text-blue-800 font-bold text-xs uppercase tracking-wide relative z-10">
                        <Zap size={14} className="fill-blue-800" /> The Commons Intelligence
                    </div>
                    <p className="text-gray-900 leading-relaxed text-base relative z-10">
                        {job.intelligenceSummary}
                    </p>
                </div>
            )}

            {/* Tags */}
            {job.tags && job.tags.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Tech Stack & Keywords</h3>
                    <div className="flex flex-wrap gap-2">
                        {job.tags.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-600">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Info Footer */}
            <div className="text-sm text-gray-500 italic border-t border-gray-100 pt-6">
                Full job description, requirements, and application available on the company website.
            </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-4 border-t border-gray-200 bg-white sticky bottom-0 flex items-center justify-between gap-4 z-20">
            <div className="hidden md:flex flex-col gap-1 text-xs text-gray-500">
                <div>via {job.externalSource || 'Direct'}</div>
                {isDirect && (
                  <a
                    className="text-[#0f766e] underline underline-offset-2 hover:text-[#0a5a54]"
                    href={introRequestHref}
                  >
                    Request intro
                  </a>
                )}
                <a
                  className="text-gray-700 underline underline-offset-2 hover:text-gray-900"
                  href={buildFeedbackMailto({ jobId: job.id, pageUrl: typeof window !== 'undefined' ? window.location.href : undefined })}
                >
                  Report an issue
                </a>
            </div>
            <div className="w-full md:w-auto flex flex-col md:flex-row gap-2">
              {isDirect && (
                <a
                  href={introRequestHref}
                  className="md:hidden w-full px-6 py-3 text-center rounded-xl border border-[#cdece8] bg-[#f4fbfa] text-[#0b5f58] font-bold text-sm"
                >
                  Request intro
                </a>
              )}
              <button 
                  type="button"
                  onClick={handleApply}
                  className="w-full md:w-auto flex-1 md:flex-none px-6 py-3.5 bg-gray-900 hover:bg-blue-600 text-white font-bold text-base rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                  Apply on Company Site 
                  <ArrowUpRight size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"/>
              </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default JobDetailModal;
