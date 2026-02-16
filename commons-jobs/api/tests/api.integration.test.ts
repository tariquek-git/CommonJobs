import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { InMemoryJobRepository } from '../src/storage/inMemoryJobRepository.js';
import { _resetRateLimitForTests } from '../src/lib/rateLimit.js';

describe('API integration', () => {
  beforeEach(() => {
    _resetRateLimitForTests();
    process.env.ADMIN_PASSWORD = 'Tark101';
    process.env.ADMIN_TOKEN_SECRET = '12345678901234567890';
  });

  it('submit -> approve -> visible -> click apply happy path', async () => {
    const repo = new InMemoryJobRepository([]);
    const app = buildApp(repo);

    const submitRes = await app.inject({
      method: 'POST',
      url: '/jobs/submissions',
      payload: {
        companyName: 'Nova Labs',
        roleTitle: 'Risk Analyst',
        externalLink: 'https://example.com/job',
        locationCountry: 'Canada',
        locationCity: 'Toronto',
        submitterName: 'Admin',
        submitterEmail: 'admin@example.com'
      }
    });

    expect(submitRes.statusCode).toBe(201);
    const submitBody = submitRes.json() as { jobId: string };
    expect(submitBody.jobId).toBeTruthy();

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/admin-login',
      payload: { password: 'Tark101' }
    });
    expect(loginRes.statusCode).toBe(200);
    const token = (loginRes.json() as { token: string }).token;
    expect(token).toBeTruthy();

    const approveRes = await app.inject({
      method: 'PATCH',
      url: `/admin/jobs/${submitBody.jobId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'active' }
    });
    expect(approveRes.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'POST',
      url: '/jobs/search',
      payload: {
        feedType: 'direct',
        filters: {
          keyword: 'risk analyst',
          remotePolicies: [],
          seniorityLevels: [],
          employmentTypes: [],
          dateRange: 'all',
          locations: []
        }
      }
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json() as { jobs: Array<{ id: string }> };
    expect(listBody.jobs.some((job) => job.id === submitBody.jobId)).toBe(true);

    const clickRes = await app.inject({
      method: 'POST',
      url: `/jobs/${submitBody.jobId}/click`
    });
    expect(clickRes.statusCode).toBe(200);
    const clickBody = clickRes.json() as { clicks: number };
    expect(clickBody.clicks).toBe(1);

    await app.close();
  });

  it('rejects admin endpoints without token', async () => {
    const app = buildApp(new InMemoryJobRepository());
    const res = await app.inject({ method: 'GET', url: '/admin/jobs' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
