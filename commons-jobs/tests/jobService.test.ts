import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __clearJobSearchCacheForTests, adminLogin, checkAdminSession, getJobs, hasAdminSession } from '../services/jobService';

beforeEach(() => {
  vi.restoreAllMocks();
  __clearJobSearchCacheForTests();
});

describe('jobService', () => {
  it('stores admin token on successful login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true })
      })
    );

    const ok = await adminLogin('admin', 'password');
    expect(ok).toBe(true);
    expect(hasAdminSession()).toBe(true);
  });

  it('checks cookie-backed admin session state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ authenticated: true })
      })
    );

    const authenticated = await checkAdminSession();
    expect(authenticated).toBe(true);
    expect(hasAdminSession()).toBe(true);
  });

  it('returns jobs from search endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [{ id: '1', roleTitle: 'Engineer' }] })
    });
    vi.stubGlobal('fetch', fetchMock);

    const jobs = await getJobs(
      {
        keyword: '',
        remotePolicies: [],
        seniorityLevels: [],
        employmentTypes: [],
        dateRange: 'all',
        locations: []
      },
      'direct'
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe('1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses cached jobs for identical requests within cache ttl', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [{ id: 'cached-1', roleTitle: 'Cached Engineer' }] })
    });
    vi.stubGlobal('fetch', fetchMock);

    const filters = {
      keyword: '',
      remotePolicies: [],
      seniorityLevels: [],
      employmentTypes: [],
      dateRange: 'all' as const,
      locations: []
    };

    const first = await getJobs(filters, 'direct');
    const second = await getJobs(filters, 'direct');

    expect(first[0].id).toBe('cached-1');
    expect(second[0].id).toBe('cached-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('forwards abort signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await getJobs(
      {
        keyword: '',
        remotePolicies: [],
        seniorityLevels: [],
        employmentTypes: [],
        dateRange: 'all',
        locations: []
      },
      'direct',
      controller.signal
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });
});
