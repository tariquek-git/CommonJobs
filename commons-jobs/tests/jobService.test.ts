import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __clearJobSearchCacheForTests,
  __resetAdminSessionForTests,
  adminLogin,
  adminLogout,
  getJobs,
  hasAdminSession,
  refreshAdminSession
} from '../services/jobService';

beforeEach(() => {
  vi.restoreAllMocks();
  __clearJobSearchCacheForTests();
  __resetAdminSessionForTests();
});

describe('jobService', () => {
  it('marks admin session active on successful login', async () => {
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

  it('refreshes admin session from the server cookie check endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ authenticated: true })
      })
    );

    const ok = await refreshAdminSession();
    expect(ok).toBe(true);
    expect(hasAdminSession()).toBe(true);
  });

  it('clears admin session on logout even if logout request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true })
      })
      .mockRejectedValueOnce(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);

    await adminLogin('admin', 'password');
    expect(hasAdminSession()).toBe(true);
    await adminLogout();
    expect(hasAdminSession()).toBe(false);
  });

  it('returns jobs from search endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [{ id: '1', roleTitle: 'Engineer' }], total: 1, page: 1, pageSize: 30 })
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await getJobs(
      {
        keyword: '',
        remotePolicies: [],
        seniorityLevels: [],
        employmentTypes: [],
        dateRange: 'all',
        locations: [],
        sort: 'newest',
        page: 1,
        pageSize: 30
      },
      'direct'
    );

    expect(response.jobs).toHaveLength(1);
    expect(response.jobs[0].id).toBe('1');
    expect(response.total).toBe(1);
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
      locations: [],
      sort: 'newest' as const,
      page: 1,
      pageSize: 30
    };

    const first = await getJobs(filters, 'direct');
    const second = await getJobs(filters, 'direct');

    expect(first.jobs[0].id).toBe('cached-1');
    expect(second.jobs[0].id).toBe('cached-1');
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
        locations: [],
        sort: 'newest',
        page: 1,
        pageSize: 30
      },
      'direct',
      controller.signal
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });
});
