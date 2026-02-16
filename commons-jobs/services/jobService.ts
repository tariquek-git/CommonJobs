import { JobPosting, JobFilterState, JobStatus } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4010';
const ADMIN_TOKEN_KEY = 'commons_jobs_admin_token';

const getToken = () => localStorage.getItem(ADMIN_TOKEN_KEY);
const setToken = (token: string) => localStorage.setItem(ADMIN_TOKEN_KEY, token);
const clearToken = () => localStorage.removeItem(ADMIN_TOKEN_KEY);

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

export const getJobs = async (filters: JobFilterState, feedType: 'direct' | 'aggregated'): Promise<JobPosting[]> => {
  const data = await apiFetch<{ jobs: JobPosting[] }>('/jobs/search', {
    method: 'POST',
    body: JSON.stringify({ filters, feedType })
  });

  return data.jobs;
};

type NewJobPayload =
  Omit<JobPosting, 'id' | 'postedDate' | 'status' | 'clicks'> &
  Partial<Pick<JobPosting, 'postedDate' | 'status' | 'clicks'>>;

export const submitJob = async (jobData: NewJobPayload): Promise<boolean> => {
  await apiFetch('/jobs/submissions', {
    method: 'POST',
    body: JSON.stringify(jobData)
  });

  return true;
};

export const createAdminJob = async (jobData: NewJobPayload): Promise<boolean> => {
  await apiFetch('/admin/jobs', {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(jobData)
  });

  return true;
};

export const trackClick = (id: string) => {
  // Intentionally fire-and-forget for UX responsiveness.
  void fetch(`${API_BASE_URL}/jobs/${id}/click`, {
    method: 'POST'
  });
};

export const adminLogin = async (password: string): Promise<boolean> => {
  try {
    const data = await apiFetch<{ token: string }>('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ password })
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

export const updateJobStatus = async (id: string, status: JobStatus): Promise<void> => {
  await apiFetch(`/admin/jobs/${id}/status`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify({ status })
  });
};

export const updateJob = async (updatedJob: JobPosting): Promise<void> => {
  await apiFetch(`/admin/jobs/${updatedJob.id}`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify(updatedJob)
  });
};

export const deleteJob = async (id: string): Promise<void> => {
  await updateJobStatus(id, 'archived');
};
