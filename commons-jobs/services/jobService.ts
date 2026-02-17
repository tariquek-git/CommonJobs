import { JobPosting, JobFilterState, JobStatus } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const ADMIN_TOKEN_KEY = 'commons_jobs_admin_token';
const JOB_SEARCH_CACHE_TTL_MS = 15_000;

type FeedType = 'direct' | 'aggregated';
type CacheEntry = { at: number; jobs: JobPosting[] };

const getToken = () => localStorage.getItem(ADMIN_TOKEN_KEY);
const setToken = (token: string) => localStorage.setItem(ADMIN_TOKEN_KEY, token);
const clearToken = () => localStorage.removeItem(ADMIN_TOKEN_KEY);
const jobSearchCache = new Map<string, CacheEntry>();

const buildJobsCacheKey = (filters: JobFilterState, feedType: FeedType): string =>
  JSON.stringify({ filters, feedType });

const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // non-json response
  }

  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body
      ? String((body as { error?: string }).error || '')
      : '';
    throw new Error(message || `Request failed (${response.status})`);
  }

  return body as T;
};

const adminHeaders = (): HeadersInit => {
  const token = getToken();
  if (!token) {
    throw new Error('Admin session expired. Please log in again.');
  }

  return {
    Authorization: `Bearer ${token}`
  };
};

export const hasAdminSession = (): boolean => Boolean(getToken());

export const getJobById = async (id: string): Promise<JobPosting | undefined> => {
  try {
    const data = await apiFetch<{ job: JobPosting }>(`/jobs/${id}`);
    return data.job;
  } catch {
    return undefined;
  }
};

export const getJobs = async (
  filters: JobFilterState,
  feedType: FeedType,
  signal?: AbortSignal
): Promise<JobPosting[]> => {
  const cacheKey = buildJobsCacheKey(filters, feedType);
  const cached = jobSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < JOB_SEARCH_CACHE_TTL_MS) {
    return cached.jobs;
  }

  const data = await apiFetch<{ jobs: JobPosting[] }>('/jobs/search', {
    method: 'POST',
    body: JSON.stringify({ filters, feedType }),
    signal
  });

  jobSearchCache.set(cacheKey, { at: Date.now(), jobs: data.jobs });
  return data.jobs;
};

export const __clearJobSearchCacheForTests = (): void => {
  jobSearchCache.clear();
};

type NewJobPayload =
  Omit<JobPosting, 'id' | 'postedDate' | 'status' | 'clicks'> &
  Partial<Pick<JobPosting, 'postedDate' | 'status' | 'clicks'>>;

export const submitJob = async (jobData: NewJobPayload): Promise<string> => {
  const data = await apiFetch<{ ok: true; jobId: string }>('/jobs/submissions', {
    method: 'POST',
    body: JSON.stringify(jobData)
  });

  jobSearchCache.clear();
  if (!data.jobId) {
    throw new Error('Submission succeeded but no job reference was returned.');
  }
  return data.jobId;
};

export const createAdminJob = async (jobData: NewJobPayload): Promise<JobPosting> => {
  const data = await apiFetch<{ job: JobPosting }>('/admin/jobs', {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(jobData)
  });

  jobSearchCache.clear();
  return data.job;
};

export const trackClick = (id: string) => {
  // Intentionally fire-and-forget for UX responsiveness.
  void fetch(`${API_BASE_URL}/jobs/${id}/click`, {
    method: 'POST',
    keepalive: true
  });
};

export const adminLogin = async (username: string, password: string): Promise<boolean> => {
  try {
    const data = await apiFetch<{ token: string }>('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    if (!data.token) return false;
    setToken(data.token);
    return true;
  } catch {
    clearToken();
    return false;
  }
};

export const adminLogout = () => {
  clearToken();
};

export const getAdminJobs = async (): Promise<JobPosting[]> => {
  const data = await apiFetch<{ jobs: JobPosting[] }>('/admin/jobs', {
    method: 'GET',
    headers: adminHeaders()
  });

  return data.jobs;
};

export type AdminRuntimeInfo = {
  ok: true;
  provider: 'file' | 'supabase';
  tables: { jobs: string; clicks: string };
  gemini: { enabled: boolean; model: string };
  env: { nodeEnv: string; trustProxy: boolean | number };
  vercel: { gitCommitSha: string | null; deploymentId: string | null };
};

export const getAdminRuntime = async (): Promise<AdminRuntimeInfo> => {
  return apiFetch<AdminRuntimeInfo>('/admin/runtime', {
    method: 'GET',
    headers: adminHeaders()
  });
};

export const updateJobStatus = async (id: string, status: JobStatus): Promise<void> => {
  await apiFetch(`/admin/jobs/${id}/status`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify({ status })
  });
  jobSearchCache.clear();
};

export const updateJob = async (updatedJob: JobPosting): Promise<void> => {
  await apiFetch(`/admin/jobs/${updatedJob.id}`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify(updatedJob)
  });
  jobSearchCache.clear();
};

export const deleteJob = async (id: string): Promise<void> => {
  await updateJobStatus(id, 'archived');
};
