import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminLogin, getJobs, hasAdminSession } from '../services/jobService';

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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ jobs: [{ id: '1', roleTitle: 'Engineer' }] })
      })
    );

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
  });
});
