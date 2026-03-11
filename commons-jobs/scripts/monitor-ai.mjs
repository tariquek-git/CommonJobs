#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL || 'https://fintechcommons.com').replace(/\/+$/, '');
const samples = Number.parseInt(process.env.AI_MONITOR_SAMPLES || '20', 10);
const fallbackThreshold = Number.parseFloat(process.env.AI_FALLBACK_THRESHOLD || '0.2');
const allowed5xx = Number.parseInt(process.env.AI_ALLOWED_5XX || '0', 10);
const rateLimitMax = Number.parseInt(process.env.AI_RATE_LIMIT_MAX || '30', 10);
const rateLimitWindowMs = Number.parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '900000', 10);
const explicitIntervalMs = Number.parseInt(process.env.AI_MONITOR_INTERVAL_MS || '0', 10);

const analyzePayload = {
  description:
    'Senior Product Manager role in Toronto focused on payments roadmap, compliance, risk controls, and engineering collaboration.'
};
const parsePayload = { query: 'senior remote risk engineer canada' };

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const request = async (path, payload) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
};

const runSeries = async (path, payload, intervalMs) => {
  const statuses = {};
  let fallbackCount = 0;
  let okCount = 0;
  let http5xx = 0;

  for (let i = 0; i < samples; i += 1) {
    const { status, body } = await request(path, payload);
    statuses[status] = (statuses[status] || 0) + 1;
    if (status >= 500) http5xx += 1;
    if (status === 200) {
      okCount += 1;
      if (body?.fallback === true) fallbackCount += 1;
    }
    if (i < samples - 1 && intervalMs > 0) {
      await sleep(intervalMs);
    }
  }

  return {
    endpoint: path,
    samples,
    statuses,
    okCount,
    fallbackCount,
    fallbackRate: okCount > 0 ? fallbackCount / okCount : 0,
    http5xx
  };
};

const run = async () => {
  assert(samples > 0, 'AI_MONITOR_SAMPLES must be > 0');

  const totalRequests = samples * 2;
  const minimumIntervalMs =
    totalRequests > 1 ? Math.ceil((totalRequests * rateLimitWindowMs) / rateLimitMax / (totalRequests - 1)) : 0;
  const intervalMs = Math.max(explicitIntervalMs, minimumIntervalMs);
  const estimatedDurationSec = Math.round((intervalMs * (totalRequests - 1)) / 1000);

  const analyze = await runSeries('/api/ai/analyze-job', analyzePayload, intervalMs);
  const parse = await runSeries('/api/ai/parse-search', parsePayload, intervalMs);

  const result = {
    ok: true,
    config: {
      baseUrl,
      samples,
      fallbackThreshold,
      allowed5xx,
      intervalMs,
      estimatedDurationSec
    },
    analyze,
    parse
  };

  const failures = [];
  for (const endpointResult of [analyze, parse]) {
    if (endpointResult.http5xx > allowed5xx) {
      failures.push(`${endpointResult.endpoint} had ${endpointResult.http5xx} 5xx responses`);
    }
    if (endpointResult.fallbackRate > fallbackThreshold) {
      failures.push(
        `${endpointResult.endpoint} fallback rate ${(endpointResult.fallbackRate * 100).toFixed(1)}% exceeded threshold ${(fallbackThreshold * 100).toFixed(1)}%`
      );
    }
    if ((endpointResult.statuses[429] || 0) > 0) {
      failures.push(
        `${endpointResult.endpoint} returned ${endpointResult.statuses[429]} rate-limited responses; increase interval or lower sample count`
      );
    }
  }

  if (failures.length > 0) {
    result.ok = false;
    result.failures = failures;
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(result, null, 2));
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
