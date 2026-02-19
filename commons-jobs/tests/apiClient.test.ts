import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, requestJson } from '../services/apiClient';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('apiClient', () => {
  it('normalizes non-2xx errors into ApiClientError', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid payload' })
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestJson('/jobs/submissions', { method: 'POST', body: {} })).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 400,
      message: 'Invalid payload'
    } satisfies Partial<ApiClientError>);
  });

  it('retries safe reads on transient failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ jobs: [{ id: '1' }] })
      });
    vi.stubGlobal('fetch', fetchMock);

    const response = await requestJson<{ jobs: Array<{ id: string }> }>('/jobs', {
      method: 'GET',
      retry: 1,
      retryDelayMs: 0
    });

    expect(response.jobs[0].id).toBe('1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry unsafe writes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Service unavailable' })
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      requestJson('/jobs/submissions', {
        method: 'POST',
        body: { roleTitle: 'Engineer' },
        retry: 2,
        retryDelayMs: 0
      })
    ).rejects.toMatchObject({ status: 503 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
