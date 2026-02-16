import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { InMemoryJobRepository } from '../src/storage/inMemoryJobRepository.js';
import { _resetRateLimitForTests } from '../src/lib/rateLimit.js';
import { hashAdminPassword } from '../src/auth/adminPassword.js';
import { parseEnv } from '../src/config/env.js';

let adminPasswordHash = '';

const buildTestEnv = (overrides: Record<string, string> = {}) =>
  parseEnv({
    NODE_ENV: 'test',
    PORT: '4010',
    DATA_FILE: 'data/jobs.json',
    CLICK_DATA_FILE: 'data/clicks.json',
    CLIENT_ORIGIN: 'http://localhost:5173',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD_HASH: adminPasswordHash,
    ADMIN_TOKEN_SECRET: '12345678901234567890123456789012',
    RATE_LIMIT_WINDOW_MS: '900000',
    RATE_LIMIT_MAX_SUBMIT: '20',
    RATE_LIMIT_MAX_ADMIN_LOGIN: '30',
    RATE_LIMIT_MAX_CLICK: '60',
    CLICK_DEDUPE_WINDOW_MS: '60000',
    TRUST_PROXY: 'false',
    ...overrides
  });

describe('API integration', () => {
  beforeAll(async () => {
    adminPasswordHash = await hashAdminPassword('Tark101', 4);
  });

  beforeEach(() => {
    _resetRateLimitForTests();
  });

  it('submit -> approve -> visible -> click apply happy path', async () => {
    const repo = new InMemoryJobRepository([]);
    const app = buildApp(repo, buildTestEnv());

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
      payload: { username: 'admin', password: 'Tark101' }
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
    const app = buildApp(new InMemoryJobRepository(), buildTestEnv());
    const res = await app.inject({ method: 'GET', url: '/admin/jobs' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects wrong admin password', async () => {
    const app = buildApp(new InMemoryJobRepository(), buildTestEnv());
    const res = await app.inject({
      method: 'POST',
      url: '/auth/admin-login',
      payload: { username: 'admin', password: 'wrong-password' }
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rate limiting uses request.ip and is not bypassed by spoofed x-forwarded-for on login', async () => {
    const app = buildApp(
      new InMemoryJobRepository(),
      buildTestEnv({
        RATE_LIMIT_MAX_ADMIN_LOGIN: '1'
      })
    );

    const first = await app.inject({
      method: 'POST',
      url: '/auth/admin-login',
      payload: { username: 'admin', password: 'wrong-password' }
    });
    expect(first.statusCode).toBe(401);

    const second = await app.inject({
      method: 'POST',
      url: '/auth/admin-login',
      headers: { 'x-forwarded-for': '8.8.8.8' },
      payload: { username: 'admin', password: 'wrong-password' }
    });
    expect(second.statusCode).toBe(429);

    await app.close();
  });

  it('rate limiting uses request.ip and is not bypassed by spoofed x-forwarded-for on submissions', async () => {
    const app = buildApp(
      new InMemoryJobRepository([]),
      buildTestEnv({
        RATE_LIMIT_MAX_SUBMIT: '1'
      })
    );

    const payload = {
      companyName: 'Nova Labs',
      roleTitle: 'Risk Analyst',
      externalLink: 'https://example.com/job',
      locationCountry: 'Canada',
      locationCity: 'Toronto',
      submitterName: 'Admin',
      submitterEmail: 'admin@example.com'
    };

    const first = await app.inject({
      method: 'POST',
      url: '/jobs/submissions',
      payload
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/jobs/submissions',
      headers: { 'x-forwarded-for': '1.1.1.1' },
      payload
    });
    expect(second.statusCode).toBe(429);

    await app.close();
  });
});
