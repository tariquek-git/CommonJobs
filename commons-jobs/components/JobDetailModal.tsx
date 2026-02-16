
import React, { useEffect, useState } from 'react';
import { JobPosting } from '../types';
import { trackClick } from '../services/jobService';
import { X, MapPin, Building2, Clock, ArrowUpRight, CheckCircle2, DollarSign, Briefcase, Zap } from 'lucide-react';

interface JobDetailModalProps {
  job: JobPosting;
  onClose: () => void;
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, onClose }) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    // Prevent background scrolling when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleApply = () => {
    trackClick(job.id);
    let targetUrl = job.externalLink;
    
    if (targetUrl && !targetUrl.startsWith('http')) {
        targetUrl = `https://${targetUrl}`;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const getDaysLabel = (dateString: string) => {
    const diffTime = Math.abs(new Date().getTime() - new Date(dateString).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const getLogoUrl = () => {
    const targetUrl = job.companyWebsite || job.externalLink;
    if (!targetUrl) return null;
    try {
      const urlStr = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
      const hostname = new URL(urlStr).hostname;
      return `https://logo.clearbit.com/${hostname}`;
    } catch {
      return null;
    }
  };

  const logoUrl = getLogoUrl();

  return (
    <div className="fixed inset-0 z-[60] flex justify-center items-end md:items-center sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity animate-fade-in" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-white rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] md:max-h-[85vh] animate-slide-up overflow-hidden">
        
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
               />
             )}
           </div>
           
           <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight mb-1">{job.roleTitle}</h2>
                    <div className="flex items-center gap-2 text-gray-600 font-medium">
                        {job.companyName}
                        {job.isVerified && (
                             <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full border border-blue-100 font-bold uppercase tracking-wider">
                                <CheckCircle2 size={10} /> Verified
                             </span>
                        )}
                    </div>
                  </div>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors">
                      <X size={20} />
                  </button>
              </div>
           </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-gray-200">
            
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
                    Posted {getDaysLabel(job.postedDate)}
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
            <div className="hidden md:block text-xs text-gray-400">
                via {job.externalSource || 'Direct'}
            </div>
            <button 
                onClick={handleApply}
                className="w-full md:w-auto flex-1 md:flex-none px-6 py-3.5 bg-gray-900 hover:bg-blue-600 text-white font-bold text-base rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
            >
                Apply on Company Site 
                <ArrowUpRight size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"/>
            </button>
        </div>

      </div>
    </div>
  );
};

export default JobDetailModal;
