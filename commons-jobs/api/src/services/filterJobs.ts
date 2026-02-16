import { JobFilterState, JobPosting } from '../types/jobs.js';

const withinDateRange = (postedDate: string, range: JobFilterState['dateRange']) => {
  if (range === 'all') return true;
  const posted = new Date(postedDate).getTime();
  const now = Date.now();
  const diffMs = now - posted;

  if (range === '24h') return diffMs <= 24 * 60 * 60 * 1000;
  if (range === '7d') return diffMs <= 7 * 24 * 60 * 60 * 1000;
  if (range === '30d') return diffMs <= 30 * 24 * 60 * 60 * 1000;
  return true;
};

export const filterPublicJobs = (
  jobs: JobPosting[],
  filters: JobFilterState,
  feedType: 'direct' | 'aggregated'
): JobPosting[] => {
  return jobs
    .filter((job) => {
      if (job.status !== 'active') return false;

      if (feedType === 'direct' && job.sourceType !== 'Direct') return false;
      if (feedType === 'aggregated' && job.sourceType !== 'Aggregated') return false;

      if (!withinDateRange(job.postedDate, filters.dateRange)) return false;

      if (filters.keyword) {
        const q = filters.keyword.toLowerCase();
        const matches =
          job.roleTitle.toLowerCase().includes(q) ||
          job.companyName.toLowerCase().includes(q) ||
          (job.tags || []).some((tag) => tag.toLowerCase().includes(q));
        if (!matches) return false;
      }

      if (filters.remotePolicies.length > 0) {
        if (!job.remotePolicy || !filters.remotePolicies.includes(job.remotePolicy)) {
          return false;
        }
      }

      if (filters.seniorityLevels.length > 0) {
        if (!job.seniority || !filters.seniorityLevels.includes(job.seniority)) {
          return false;
        }
      }

      if (filters.employmentTypes.length > 0) {
        if (!job.employmentType || !filters.employmentTypes.includes(job.employmentType)) {
          return false;
        }
      }

      if (filters.locations.length > 0) {
        const haystack = `${job.locationCity || ''} ${job.locationState || ''} ${job.locationCountry || ''}`.toLowerCase();
        const locationMatch = filters.locations.some((location) => haystack.includes(location.toLowerCase()));
        if (!locationMatch) return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());
};
