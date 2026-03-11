#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL || 'https://fintechcommons.com').replace(/\/+$/, '');
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const keepSmoke = process.env.KEEP_SMOKE === '1';

const now = new Date().toISOString();
const smokeTitle = `OPS Smoke Role ${now}`;
const smokeModerationNote = 'Smoke test status transition.';

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
};

const run = async () => {
  const summary = {
    baseUrl,
    createdJobId: null,
    approved: false,
    pendingClickBlocked: false,
    activeClickTracked: false,
    cleanedUp: false
  };

  {
    const { response, body } = await requestJson('/api/health', { method: 'GET', headers: {} });
    assert(response.status === 200, `health failed with ${response.status}`);
    assert(body?.ok === true, 'health response missing ok=true');
  }

  {
    const payload = {
      feedType: 'direct',
      filters: {
        keyword: '',
        remotePolicies: [],
        seniorityLevels: [],
        employmentTypes: [],
        dateRange: 'all',
        locations: []
      },
      page: 1,
      pageSize: 5
    };
    const { response } = await requestJson('/api/jobs/search', { method: 'POST', body: JSON.stringify(payload) });
    assert(response.status === 200, `direct search failed with ${response.status}`);
  }

  {
    const payload = {
      feedType: 'aggregated',
      filters: {
        keyword: '',
        remotePolicies: [],
        seniorityLevels: [],
        employmentTypes: [],
        dateRange: 'all',
        locations: []
      },
      page: 1,
      pageSize: 5
    };
    const { response } = await requestJson('/api/jobs/search', { method: 'POST', body: JSON.stringify(payload) });
    assert(response.status === 200, `aggregated search failed with ${response.status}`);
  }

  const submissionPayload = {
    companyName: 'Ops Smoke Co',
    roleTitle: smokeTitle,
    externalLink: 'https://example.com/jobs/ops-smoke-role',
    locationCountry: 'Canada',
    locationCity: 'Toronto',
    remotePolicy: 'Remote',
    submitterName: 'Ops Smoke',
    submitterEmail: 'ops-smoke@example.com'
  };

  {
    const { response, body } = await requestJson('/api/jobs/submissions', {
      method: 'POST',
      body: JSON.stringify(submissionPayload)
    });
    assert(response.status === 201, `submission failed with ${response.status}`);
    assert(typeof body?.jobId === 'string' && body.jobId.length > 0, 'submission missing jobId');
    summary.createdJobId = body.jobId;
  }

  assert(summary.createdJobId, 'missing created smoke job id');

  {
    const { response } = await requestJson(`/api/jobs/${summary.createdJobId}/click`, { method: 'POST', body: '{}' });
    assert(response.status === 404, `pending click should be blocked, got ${response.status}`);
    summary.pendingClickBlocked = true;
  }

  assert(adminUsername && adminPassword, 'ADMIN_USERNAME and ADMIN_PASSWORD are required for admin checks');

  let cookieHeader = '';
  {
    const { response, body } = await requestJson('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ username: adminUsername, password: adminPassword })
    });
    assert(response.status === 200, `admin login failed with ${response.status}`);
    assert(body?.ok === true, 'admin login response missing ok=true');
    cookieHeader = response.headers.get('set-cookie') || '';
    assert(cookieHeader.includes('='), 'admin login missing set-cookie header');
  }

  const authHeaders = { cookie: cookieHeader };

  {
    const { response } = await requestJson(`/api/admin/jobs/${summary.createdJobId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'active', moderationNote: smokeModerationNote })
    });
    assert(response.status === 200, `approve smoke job failed with ${response.status}`);
    summary.approved = true;
  }

  {
    const { response, body } = await requestJson(`/api/jobs/${summary.createdJobId}`, { method: 'GET', headers: {} });
    assert(response.status === 200, `public detail failed with ${response.status}`);
    assert(body?.job?.status === 'active', 'approved smoke job not visible as active');
  }

  {
    const { response, body } = await requestJson(`/api/jobs/${summary.createdJobId}/click`, { method: 'POST', body: '{}' });
    assert(response.status === 200, `active click failed with ${response.status}`);
    assert(typeof body?.clicks === 'number', 'active click response missing clicks');
    summary.activeClickTracked = true;
  }

  if (!keepSmoke) {
    const { response } = await requestJson(`/api/admin/jobs/${summary.createdJobId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'archived', moderationNote: 'Smoke cleanup' })
    });
    assert(response.status === 200, `smoke cleanup archive failed with ${response.status}`);
    summary.cleanedUp = true;
  }

  console.log(JSON.stringify({ ok: true, summary }, null, 2));
};

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
