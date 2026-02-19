import { EmploymentType, JobFilterState, JobPosting, JobSearchFacets, JobSortOption, RemotePolicy, SeniorityLevel } from '../types/jobs.js';

const REMOTE_POLICY_VALUES: RemotePolicy[] = ['Onsite', 'Hybrid', 'Remote'];
const EMPLOYMENT_TYPE_VALUES: EmploymentType[] = ['Full-time', 'Contract', 'Internship'];
const SENIORITY_VALUES: SeniorityLevel[] = ['Junior', 'Mid-Level', 'Senior', 'Lead', 'Executive'];

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
  feedType: 'direct' | 'aggregated',
  sort: JobSortOption = 'newest'
): JobPosting[] => {
  return sortPublicJobs(
    jobs
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
    }),
    sort,
    feedType
  );
};

export const sortPublicJobs = (
  jobs: JobPosting[],
  sort: JobSortOption,
  feedType: 'direct' | 'aggregated'
): JobPosting[] => {
  const input = [...jobs];
  switch (sort) {
    case 'most_clicked': {
      if (feedType !== 'direct') {
        return input.sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());
      }
      return input.sort((a, b) => {
        const diff = (b.clicks || 0) - (a.clicks || 0);
        if (diff !== 0) return diff;
        return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime();
      });
    }
    case 'company_az':
      return input.sort((a, b) => {
        const companyDiff = a.companyName.localeCompare(b.companyName);
        if (companyDiff !== 0) return companyDiff;
        return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime();
      });
    case 'newest':
    default:
      return input.sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());
  }
};

export const buildSearchFacets = (jobs: JobPosting[]): JobSearchFacets => {
  const facets: JobSearchFacets = {
    remotePolicies: { Onsite: 0, Hybrid: 0, Remote: 0 },
    employmentTypes: { 'Full-time': 0, Contract: 0, Internship: 0 },
    seniorityLevels: { Junior: 0, 'Mid-Level': 0, Senior: 0, Lead: 0, Executive: 0 }
  };

  for (const job of jobs) {
    if (job.remotePolicy && REMOTE_POLICY_VALUES.includes(job.remotePolicy)) {
      facets.remotePolicies[job.remotePolicy] += 1;
    }
    if (job.employmentType && EMPLOYMENT_TYPE_VALUES.includes(job.employmentType)) {
      facets.employmentTypes[job.employmentType] += 1;
    }
    if (job.seniority && SENIORITY_VALUES.includes(job.seniority)) {
      facets.seniorityLevels[job.seniority] += 1;
    }
  }

  return facets;
};
