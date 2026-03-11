export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface Counter {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Counter>();
const MAX_BUCKETS = 10_000;
const PRUNE_INTERVAL_MS = 60_000;
let lastPruneAt = 0;

const pruneBuckets = (now: number, force = false) => {
  if (!force && now - lastPruneAt < PRUNE_INTERVAL_MS) {
    return;
  }

  for (const [key, counter] of buckets.entries()) {
    if (counter.resetAt <= now) {
      buckets.delete(key);
    }
  }

  if (buckets.size > MAX_BUCKETS) {
    const overflow = buckets.size - MAX_BUCKETS;
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }

  lastPruneAt = now;
};

export const checkRateLimit = (key: string, config: RateLimitConfig): { ok: boolean; retryAfterSec: number } => {
  const now = Date.now();
  pruneBuckets(now, buckets.size > MAX_BUCKETS);
  const existing = buckets.get(key);

  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return { ok: true, retryAfterSec: Math.ceil(config.windowMs / 1000) };
  }

  if (existing.count >= config.maxRequests) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  existing.count += 1;
  return { ok: true, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
};

export const _resetRateLimitForTests = () => {
  buckets.clear();
  lastPruneAt = 0;
};
