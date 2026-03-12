import { JobPosting, JobFilterState, JobSearchFacets, JobStatus } from '../types';
import { requestJson, requestVoid } from './apiClient';

const JOB_SEARCH_CACHE_TTL_MS = 15_000;

type FeedType = 'direct' | 'aggregated';
type AggregatedPolicyMeta = {
  aggregatedPolicyApplied: boolean;
  companyCapApplied: boolean;
  aggregatedCounts: { beforePolicy: number; afterPolicy: number };
  policy: {
    country: 'Canada';
    maxAgeDays: number;
    maxResults: number;
    maxPerCompany: number;
  } | null;
};

type JobsSearchResponse = {
  jobs: JobPosting[];
  total: number;
  page: number;
  pageSize: number;
  facets: JobSearchFacets;
  meta?: AggregatedPolicyMeta;
};
type CacheEntry = { at: number; response: JobsSearchResponse };

const jobSearchCache = new Map<string, CacheEntry>();
let adminSessionActive = false;

const buildJobsCacheKey = (filters: JobFilterState, feedType: FeedType): string =>
  JSON.stringify({ filters, feedType });

export const hasAdminSession = (): boolean => adminSessionActive;

export const getJobById = async (id: string): Promise<JobPosting | undefined> => {
  try {
    const data = await requestJson<{ job: JobPosting }>(`/jobs/${id}`, { method: 'GET', retry: 1 });
    return data.job;
  } catch {
    return undefined;
  }
};

export const getJobs = async (
  filters: JobFilterState,
  feedType: FeedType,
  signal?: AbortSignal
): Promise<JobsSearchResponse> => {
  const cacheKey = buildJobsCacheKey(filters, feedType);
  const cached = jobSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < JOB_SEARCH_CACHE_TTL_MS) {
    return cached.response;
  }

  const data = await requestJson<Partial<JobsSearchResponse> & { jobs: JobPosting[] }>('/jobs/search', {
    method: 'POST',
    idempotent: true,
    retry: 1,
    retryDelayMs: 150,
    body: {
      filters: {
        keyword: filters.keyword,
        remotePolicies: filters.remotePolicies,
        seniorityLevels: filters.seniorityLevels,
        employmentTypes: filters.employmentTypes,
        dateRange: filters.dateRange,
        locations: filters.locations
      },
      feedType,
      sort: filters.sort,
      page: filters.page,
      pageSize: filters.pageSize
    },
    signal
  });

  const response: JobsSearchResponse = {
    jobs: data.jobs || [],
    total: typeof data.total === 'number' ? data.total : (data.jobs || []).length,
    page: typeof data.page === 'number' ? data.page : filters.page,
    pageSize: typeof data.pageSize === 'number' ? data.pageSize : filters.pageSize,
    facets: data.facets || {
      remotePolicies: { Onsite: 0, Hybrid: 0, Remote: 0 },
      employmentTypes: { 'Full-time': 0, Contract: 0, Internship: 0 },
      seniorityLevels: { Junior: 0, 'Mid-Level': 0, Senior: 0, Lead: 0, Executive: 0 }
    },
    meta: data.meta
  };

  jobSearchCache.set(cacheKey, { at: Date.now(), response });
  return response;
};

export const __clearJobSearchCacheForTests = (): void => {
  jobSearchCache.clear();
};

export const __resetAdminSessionForTests = (): void => {
  adminSessionActive = false;
};

type NewJobPayload =
  Omit<JobPosting, 'id' | 'postedDate' | 'status' | 'clicks'> &
  Partial<Pick<JobPosting, 'postedDate' | 'status' | 'clicks'>>;

export const submitJob = async (jobData: NewJobPayload): Promise<string> => {
  const data = await requestJson<{ ok: true; jobId: string }>('/jobs/submissions', {
    method: 'POST',
    body: jobData
  });

  jobSearchCache.clear();
  if (!data.jobId) {
    throw new Error('Submission succeeded but no job reference was returned.');
  }
  return data.jobId;
};

export const createAdminJob = async (jobData: NewJobPayload): Promise<JobPosting> => {
  const data = await requestJson<{ job: JobPosting }>('/admin/jobs', {
    method: 'POST',
    credentials: 'include',
    body: jobData
  });

  jobSearchCache.clear();
  return data.job;
};

export const trackClick = (id: string) => {
  // Intentionally fire-and-forget for UX responsiveness.
  void requestVoid(`/jobs/${id}/click`, {
    method: 'POST',
    keepalive: true
  });
};

export const adminLogin = async (username: string, password: string): Promise<boolean> => {
  try {
    const data = await requestJson<{ ok?: boolean }>('/auth/admin-login', {
      method: 'POST',
      credentials: 'include',
      body: { username, password }
    });

    adminSessionActive = Boolean(data.ok);
    return adminSessionActive;
  } catch {
    adminSessionActive = false;
    return false;
  }
};

export const refreshAdminSession = async (): Promise<boolean> => {
  try {
    const data = await requestJson<{ authenticated?: boolean }>('/auth/admin-session', {
      method: 'GET',
      credentials: 'include',
      retry: 1
    });
    adminSessionActive = Boolean(data.authenticated);
    return adminSessionActive;
  } catch {
    adminSessionActive = false;
    return false;
  }
};

export const adminLogout = async (): Promise<void> => {
  try {
    await requestVoid('/auth/admin-logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch {
    // Best-effort logout: clear client session state even if the network call fails.
  } finally {
    adminSessionActive = false;
  }
};

export const getAdminJobs = async (): Promise<JobPosting[]> => {
  const data = await requestJson<{ jobs: JobPosting[] }>('/admin/jobs', {
    method: 'GET',
    credentials: 'include',
    retry: 1
  });

  return data.jobs;
};

export type AdminRuntimeInfo = {
  ok: true;
  provider: 'file' | 'supabase';
  tables: { jobs: string; clicks: string };
  gemini: { enabled: boolean; model: string };
  env: { nodeEnv: string; trustProxy: boolean | number };
  storageProbe?: {
    ok: boolean;
    totalJobs: number | null;
    error: string | null;
  };
  vercel: { gitCommitSha: string | null; deploymentId: string | null };
};

export const getAdminRuntime = async (): Promise<AdminRuntimeInfo> => {
  return requestJson<AdminRuntimeInfo>('/admin/runtime', {
    method: 'GET',
    credentials: 'include',
    retry: 1
  });
};

export const updateJobStatus = async (id: string, status: JobStatus, moderationNote?: string): Promise<void> => {
  await requestJson(`/admin/jobs/${id}/status`, {
    method: 'PATCH',
    credentials: 'include',
    body: { status, moderationNote }
  });
  jobSearchCache.clear();
};

export const updateJob = async (updatedJob: JobPosting): Promise<void> => {
  await requestJson(`/admin/jobs/${updatedJob.id}`, {
    method: 'PATCH',
    credentials: 'include',
    body: updatedJob
  });
  jobSearchCache.clear();
};

export const deleteJob = async (id: string): Promise<void> => {
  await updateJobStatus(id, 'archived');
};
