import React, { useEffect, useState } from 'react';
import { JobPosting } from '../types';
import { MapPin, ArrowUpRight, Building2, Clock3, Globe, ShieldCheck, HeartHandshake } from 'lucide-react';
import { getPostedDateLabel } from '../utils/dateLabel';
import { getCompanyLogoCandidates } from '../utils/companyLogo';

interface JobCardProps {
  job: JobPosting;
  onSelect: (job: JobPosting) => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, onSelect }) => {
  const [imgError, setImgError] = useState(false);
  const [logoIndex, setLogoIndex] = useState(0);

  const isAggregated = job.sourceType === 'Aggregated';
  const isDirect = job.sourceType === 'Direct';
  const logoCandidates = getCompanyLogoCandidates(job.companyWebsite, job.externalLink);
  const logoUrl = logoCandidates[logoIndex] ?? null;
  const dateLabel = getPostedDateLabel(job.postedDate);

  useEffect(() => {
    setImgError(false);
    setLogoIndex(0);
  }, [job.id, job.companyWebsite, job.externalLink]);

  const location = [job.locationCity, job.locationCountry === 'United States' ? 'USA' : job.locationCountry]
    .filter(Boolean)
    .join(', ');

  return (
    <article
      className={`group relative h-full overflow-hidden rounded-[18px] border bg-[var(--cj-surface-elevated)] shadow-[var(--cj-shadow-soft)] transition-premium hover:-translate-y-[2px] hover:shadow-[var(--cj-shadow-elevated)] ${
        isAggregated ? 'border-[#c8e6e0]' : 'border-[var(--cj-stroke-soft)]'
      }`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-14 ${
          isDirect
            ? 'bg-[linear-gradient(180deg,rgba(24,59,132,0.08),transparent)]'
            : 'bg-[linear-gradient(180deg,rgba(53,206,184,0.12),transparent)]'
        }`}
      />
      <button
        type="button"
        onClick={() => onSelect(job)}
        className="relative z-10 flex h-full w-full flex-col p-5 text-left focus-visible:focus-ring md:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[13px] border border-[var(--cj-stroke-soft)] bg-[#f8fafd]">
            <Building2 size={20} className="absolute text-[#9cabc1]" />
            {!imgError && logoUrl && (
              <img
                src={logoUrl}
                alt={`${job.companyName} logo`}
                className="relative z-10 h-full w-full bg-white object-contain"
                onError={() => {
                  if (logoIndex < logoCandidates.length - 1) {
                    setLogoIndex((prev) => prev + 1);
                    return;
                  }
                  setImgError(true);
                }}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          <div
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              isDirect
                ? 'border-[#d8e8ff] bg-[#f5f9ff] text-[#2f5c9b]'
                : 'border-[#cdece8] bg-[#f1faf8] text-[#0f766e]'
            }`}
          >
            {isDirect ? <ShieldCheck size={11} /> : <Globe size={11} />}
            {isDirect ? 'Community reviewed' : 'Web Pulse'}
          </div>
        </div>

        <div className="mb-3.5">
          <h3
            className="mb-1.5 text-[1.13rem] font-semibold leading-[1.25] tracking-[-0.01em] text-[var(--cj-text-primary)] transition-premium group-hover:text-[#0f5f59]"
            title={job.roleTitle}
          >
            {job.roleTitle}
          </h3>
          <p className="truncate text-[15px] font-medium text-[var(--cj-text-secondary)]">{job.companyName}</p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[var(--cj-text-muted)]">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${
              isDirect ? 'border-[#d8e8ff] bg-[#f5f9ff] text-[#2f5c9b]' : 'border-[#cdece8] bg-[#f1faf8] text-[#0f766e]'
            }`}
          >
            {isDirect ? <ShieldCheck size={11} /> : <Globe size={11} />}
            {isDirect ? 'Verified' : 'Market'}
          </span>
          {location && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--cj-stroke-soft)] bg-[#f7fafc] px-2.5 py-1">
              <MapPin size={11} />
              {location}
            </span>
          )}
          {job.remotePolicy && <span className="rounded-full border border-[var(--cj-stroke-soft)] bg-[#f7fafc] px-2.5 py-1">{job.remotePolicy}</span>}
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--cj-stroke-soft)] bg-[#f7fafc] px-2.5 py-1">
            <Clock3 size={11} />
            {dateLabel}
          </span>
        </div>

        <div
          className={`mb-5 min-h-[116px] rounded-[12px] border px-3.5 py-3 ${
            isAggregated ? 'border-[#d5ebe7] bg-[#f3fbf9]' : 'border-[#e5ecf1] bg-[#f8fafd]'
          }`}
        >
          <p className="line-clamp-4 text-sm leading-relaxed text-[var(--cj-text-secondary)]">
            {job.intelligenceSummary || 'Open the role to review the full posting and details.'}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-4 border-t border-[var(--cj-stroke-soft)] pt-4">
          <div className="text-[11px] text-[var(--cj-text-muted)]">
            {isDirect ? (
              <span className="inline-flex items-center gap-1 text-[var(--cj-accent-strong)]">
                <HeartHandshake size={12} />
                Warm intro possible
              </span>
            ) : (
              <span>via {job.externalSource || 'Web source'}</span>
            )}
          </div>

          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[12px] border border-[var(--cj-accent-navy)] bg-[var(--cj-accent-navy)] px-3.5 py-2 text-sm font-semibold text-white transition-premium group-hover:border-[var(--cj-accent)] group-hover:bg-[var(--cj-accent)] group-hover:text-[var(--cj-accent-navy)]"
            aria-hidden="true"
          >
            Apply
            <ArrowUpRight size={15} />
          </span>
        </div>
      </button>
    </article>
  );
};

export default React.memo(JobCard);
