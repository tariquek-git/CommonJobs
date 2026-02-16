import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { JobPosting } from '../src/types/jobs.js';
import { InMemoryClickRepository } from '../src/storage/inMemoryClickRepository.js';
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
    const app = buildApp(repo, new InMemoryClickRepository(), buildTestEnv());

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
    const app = buildApp(new InMemoryJobRepository(), new InMemoryClickRepository(), buildTestEnv());
    const res = await app.inject({ method: 'GET', url: '/admin/jobs' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects wrong admin password', async () => {
    const app = buildApp(new InMemoryJobRepository(), new InMemoryClickRepository(), buildTestEnv());
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
      new InMemoryClickRepository(),
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
      new InMemoryClickRepository(),
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

  it('rejects invalid submission payloads', async () => {
    const app = buildApp(new InMemoryJobRepository([]), new InMemoryClickRepository(), buildTestEnv());
    const res = await app.inject({
      method: 'POST',
      url: '/jobs/submissions',
      payload: {
        companyName: 'Nova Labs',
        roleTitle: 'Risk Analyst'
      }
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('click endpoint increments only active jobs and dedupes rapid repeated clicks', async () => {
    const pendingJob: JobPosting = {
      id: 'job-pending',
      companyName: 'Acme',
      companyWebsite: 'https://example.com',
      roleTitle: 'Pending Role',
      externalLink: 'https://example.com/apply',
      postedDate: new Date().toISOString(),
      status: 'pending',
      sourceType: 'Direct',
      isVerified: true,
      clicks: 0
    };

    const activeJob: JobPosting = {
      ...pendingJob,
      id: 'job-active',
      roleTitle: 'Active Role',
      status: 'active'
    };

    const app = buildApp(
      new InMemoryJobRepository([pendingJob, activeJob]),
      new InMemoryClickRepository(),
      buildTestEnv({
        RATE_LIMIT_MAX_CLICK: '10',
        CLICK_DEDUPE_WINDOW_MS: '60000'
      })
    );

    const pendingClick = await app.inject({
      method: 'POST',
      url: '/jobs/job-pending/click'
    });
    expect(pendingClick.statusCode).toBe(404);

    const firstActiveClick = await app.inject({
      method: 'POST',
      url: '/jobs/job-active/click'
    });
    expect(firstActiveClick.statusCode).toBe(200);
    expect((firstActiveClick.json() as { clicks: number }).clicks).toBe(1);

    const duplicateClick = await app.inject({
      method: 'POST',
      url: '/jobs/job-active/click'
    });
    expect(duplicateClick.statusCode).toBe(200);
    const duplicateBody = duplicateClick.json() as { clicks: number; deduped?: boolean };
    expect(duplicateBody.clicks).toBe(1);
    expect(duplicateBody.deduped).toBe(true);

    await app.close();
  });

  it('click endpoint rate limit applies per request.ip', async () => {
    const activeJob: JobPosting = {
      id: 'job-active',
      companyName: 'Acme',
      companyWebsite: 'https://example.com',
      roleTitle: 'Active Role',
      externalLink: 'https://example.com/apply',
      postedDate: new Date().toISOString(),
      status: 'active',
      sourceType: 'Direct',
      isVerified: true,
      clicks: 0
    };

    const app = buildApp(
      new InMemoryJobRepository([activeJob]),
      new InMemoryClickRepository(),
      buildTestEnv({
        RATE_LIMIT_MAX_CLICK: '1',
        CLICK_DEDUPE_WINDOW_MS: '0'
      })
    );

    const first = await app.inject({
      method: 'POST',
      url: '/jobs/job-active/click'
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/jobs/job-active/click',
      headers: { 'x-forwarded-for': '203.0.113.1' }
    });
    expect(second.statusCode).toBe(429);

    await app.close();
  });
});
