
import React, { useId, useState } from 'react';
import { JobPosting } from '../types';
import { MapPin, ArrowUpRight, Building2, Clock, Globe, Bot } from 'lucide-react';
import { getPostedAgeDays, getPostedDateLabel } from '../utils/dateLabel';
import { getCompanyLogoUrl } from '../utils/companyLogo';

interface JobCardProps {
  job: JobPosting;
  onSelect: (job: JobPosting) => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, onSelect }) => {
  const [imgError, setImgError] = useState(false);
  const titleId = useId();
  const companyId = useId();

  const getLocationString = () => {
    const parts = [];
    if (job.locationCity) parts.push(job.locationCity);
    if (job.locationCountry === 'United States') parts.push('USA');
    else if (job.locationCountry) parts.push(job.locationCountry);
    return parts.join(', ');
  };

  const dateLabel = getPostedDateLabel(job.postedDate);
  const days = getPostedAgeDays(job.postedDate);
  const isHot = typeof days === 'number' && days <= 5;
  const isAggregated = job.sourceType === 'Aggregated';
  const logoUrl = getCompanyLogoUrl(job.companyWebsite, job.externalLink);

  return (
    <article
      className={`group bg-white rounded-xl border p-6 flex flex-col h-full transition-all duration-200 hover:shadow-md relative cursor-pointer ${
          isAggregated ? 'border-blue-100 hover:border-blue-300' : 'border-gray-200 hover:border-blue-300'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(job)}
        className="w-full h-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-lg"
        aria-labelledby={`${titleId} ${companyId}`}
      >
      
      {/* Top: Logo & Meta */}
      <div className="mb-4 flex items-start justify-between">
        <div className="relative w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
             {/* Fallback Icon */}
             <Building2 size={20} className="text-gray-300 absolute" />
             
             {/* Company Logo */}
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
        
        {isHot && !isAggregated && (
            <div className="bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-full border border-orange-100 flex items-center gap-1">
                🔥 New
            </div>
        )}
        {isAggregated && (
            <div className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-1 rounded-full border border-blue-100 flex items-center gap-1">
                <Bot size={10} /> Auto-Pulled
            </div>
        )}
      </div>

      {/* Main Info */}
      <div className="mb-4">
        <h3
          id={titleId}
          className="font-bold text-gray-900 text-lg leading-tight mb-1.5 group-hover:text-blue-600 transition-colors"
          title={job.roleTitle}
        >
            {job.roleTitle}
        </h3>
        <div id={companyId} className="text-sm font-medium text-gray-600 truncate flex items-center gap-1">
            {job.companyName}
        </div>
      </div>

      {/* Metadata Row */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-600 mb-5">
        {(job.locationCity || job.locationCountry) && (
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-700">
                <MapPin size={10} className="text-gray-400"/>
                {getLocationString()}
            </div>
        )}
        
        <div className="px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-700">
            {job.remotePolicy}
        </div>
        
        {job.salaryRange && (
            <div className="px-2.5 py-1.5 rounded-md bg-green-50 text-green-700 border border-green-100">
                {job.currency || 'USD'} {job.salaryRange}
            </div>
        )}
      </div>

      {/* Intelligence Block */}
      {job.intelligenceSummary && (
          <div className={`mb-6 rounded-lg p-3 grow ${isAggregated ? 'bg-blue-50/30 border border-blue-50' : 'bg-gray-50/80 border border-gray-100'}`}>
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed line-clamp-3">
                  {job.intelligenceSummary}
              </p>
          </div>
      )}

      {/* Footer / Action */}
      <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between gap-4">
         <div className="text-xs text-gray-500 flex flex-col gap-0.5">
           <div className="flex items-center gap-1.5">
                <Clock size={12} />
                <span>{dateLabel}</span>
           </div>
           <div className="flex items-center gap-1.5">
                <Globe size={12} />
                <span>via {job.externalSource || 'Direct'}</span>
           </div>
        </div>

        {/* Visual Button - Click actually bubbles to container */}
        <span
          className="px-4 py-2.5 bg-gray-900 group-hover:bg-blue-600 text-white text-sm font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 shrink-0"
          aria-hidden="true"
        >
          Apply <ArrowUpRight size={16} />
        </span>
      </div>
      </button>
    </article>
  );
};

export default React.memo(JobCard);
