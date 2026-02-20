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

const pruneBuckets = (now: number) => {
  for (const [key, counter] of buckets.entries()) {
    if (now > counter.resetAt) {
      buckets.delete(key);
    }
  }

  if (buckets.size <= MAX_BUCKETS) return;

  const overflow = buckets.size - MAX_BUCKETS;
  const bySoonestReset = Array.from(buckets.entries())
    .sort((a, b) => a[1].resetAt - b[1].resetAt)
    .slice(0, overflow);

  for (const [key] of bySoonestReset) {
    buckets.delete(key);
  }
};

export const checkRateLimit = (key: string, config: RateLimitConfig): { ok: boolean; retryAfterSec: number } => {
  const now = Date.now();
  pruneBuckets(now);
  const existing = buckets.get(key);

  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    if (buckets.size > MAX_BUCKETS) pruneBuckets(now);
    return { ok: true, retryAfterSec: Math.ceil(config.windowMs / 1000) };
  }

  if (existing.count >= config.maxRequests) {
    if (buckets.size > MAX_BUCKETS) pruneBuckets(now);
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  existing.count += 1;
  if (buckets.size > MAX_BUCKETS) pruneBuckets(now);
  return { ok: true, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
};

export const _resetRateLimitForTests = () => {
  buckets.clear();
};

export const _getRateLimitBucketSizeForTests = () => buckets.size;
