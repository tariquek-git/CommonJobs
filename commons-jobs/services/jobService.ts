import { JobFilterState, JobPosting, JobStatus } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const JOB_SEARCH_CACHE_TTL_MS = 15_000;

type FeedType = 'direct' | 'aggregated';
type CacheEntry = { at: number; jobs: JobPosting[] };

let inMemoryAdminToken: string | null = null;
let hasCookieSession = false;
const jobSearchCache = new Map<string, CacheEntry>();

const buildJobsCacheKey = (filters: JobFilterState, feedType: FeedType): string =>
  JSON.stringify({ filters, feedType });

const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
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
  if (!inMemoryAdminToken) return {};
  return { Authorization: `Bearer ${inMemoryAdminToken}` };
};

export const hasAdminSession = (): boolean => hasCookieSession || Boolean(inMemoryAdminToken);

export const checkAdminSession = async (): Promise<boolean> => {
  try {
    const data = await apiFetch<{ authenticated: boolean }>('/auth/admin-session', {
      method: 'GET'
    });
    hasCookieSession = Boolean(data.authenticated);
    if (!hasCookieSession) inMemoryAdminToken = null;
    return hasCookieSession;
  } catch {
    hasCookieSession = false;
    inMemoryAdminToken = null;
    return false;
  }
};

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

export const submitJob = async (jobData: NewJobPayload): Promise<boolean> => {
  await apiFetch('/jobs/submissions', {
    method: 'POST',
    body: JSON.stringify(jobData)
  });

  jobSearchCache.clear();
  return true;
};

export const createAdminJob = async (jobData: NewJobPayload): Promise<boolean> => {
  await apiFetch('/admin/jobs', {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(jobData)
  });

  jobSearchCache.clear();
  return true;
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
    const data = await apiFetch<{ ok?: boolean; token?: string }>('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    inMemoryAdminToken = typeof data.token === 'string' ? data.token : null;
    hasCookieSession = true;
    return true;
  } catch {
    inMemoryAdminToken = null;
    hasCookieSession = false;
    return false;
  }
};

export const adminLogout = async (): Promise<void> => {
  inMemoryAdminToken = null;
  hasCookieSession = false;
  try {
    await apiFetch('/auth/admin-logout', { method: 'POST' });
  } catch {
    // best effort logout cleanup
  }
};

export const getAdminJobs = async (): Promise<JobPosting[]> => {
  const data = await apiFetch<{ jobs: JobPosting[] }>('/admin/jobs', {
    method: 'GET',
    headers: adminHeaders()
  });

  return data.jobs;
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
