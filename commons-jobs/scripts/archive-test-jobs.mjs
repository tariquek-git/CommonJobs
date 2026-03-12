#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL || 'https://fintechcommons.com').replace(/\/+$/, '');
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const titlePattern = new RegExp(process.env.TITLE_PATTERN || 'qa|smoke|test', 'i');
const companyPattern = new RegExp(process.env.COMPANY_PATTERN || 'qa|smoke|test', 'i');
const sourcePattern = new RegExp(process.env.SOURCE_PATTERN || 'qa|smoke|test', 'i');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
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
  assert(adminUsername && adminPassword, 'ADMIN_USERNAME and ADMIN_PASSWORD are required');

  const login = await requestJson('/api/auth/admin-login', {
    method: 'POST',
    body: JSON.stringify({ username: adminUsername, password: adminPassword })
  });
  assert(login.response.status === 200, `admin login failed with ${login.response.status}`);
  const cookie = login.response.headers.get('set-cookie') || '';
  assert(cookie.includes('='), 'missing admin session cookie');

  const jobsRes = await requestJson('/api/admin/jobs', {
    method: 'GET',
    headers: { cookie }
  });
  assert(jobsRes.response.status === 200, `admin jobs failed with ${jobsRes.response.status}`);

  const jobs = Array.isArray(jobsRes.body?.jobs) ? jobsRes.body.jobs : [];
  const matches = jobs.filter((job) => {
    if (job.status === 'archived') return false;
    const roleTitle = job.roleTitle || '';
    const companyName = job.companyName || '';
    const externalSource = job.externalSource || '';
    return titlePattern.test(roleTitle) || companyPattern.test(companyName) || sourcePattern.test(externalSource);
  });

  const archivedIds = [];
  for (const job of matches) {
    const updateRes = await requestJson(`/api/admin/jobs/${job.id}/status`, {
      method: 'PATCH',
      headers: { cookie },
      body: JSON.stringify({
        status: 'archived',
        moderationNote: 'Archived during beta hygiene cleanup (qa/smoke/test pattern).'
      })
    });
    assert(updateRes.response.status === 200, `failed to archive ${job.id}: ${updateRes.response.status}`);
    archivedIds.push(job.id);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        matched: matches.length,
        archived: archivedIds.length,
        archivedIds
      },
      null,
      2
    )
  );
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
