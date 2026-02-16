import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __clearJobSearchCacheForTests, adminLogin, getJobs, hasAdminSession } from '../services/jobService';

class LocalStorageMock {
  private readonly store = new Map<string, string>();

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  vi.restoreAllMocks();
  __clearJobSearchCacheForTests();
  Object.defineProperty(globalThis, 'localStorage', {
    value: new LocalStorageMock(),
    configurable: true
  });
});

describe('jobService', () => {
  it('stores admin token on successful login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'abc123' })
      })
    );

    const ok = await adminLogin('admin', 'password');
    expect(ok).toBe(true);
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
