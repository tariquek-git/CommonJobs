export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface Counter {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Counter>();

export const checkRateLimit = (key: string, config: RateLimitConfig): { ok: boolean; retryAfterSec: number } => {
  const now = Date.now();
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
};
