import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _getRateLimitBucketSizeForTests, _resetRateLimitForTests, checkRateLimit } from '../src/lib/rateLimit.js';

describe('rateLimit bucket pruning', () => {
  beforeEach(() => {
    _resetRateLimitForTests();
    vi.useRealTimers();
  });

  it('removes expired buckets during subsequent checks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-20T00:00:00.000Z'));

    checkRateLimit('first', { windowMs: 1, maxRequests: 1 });
    expect(_getRateLimitBucketSizeForTests()).toBe(1);

    vi.setSystemTime(new Date('2026-02-20T00:00:01.000Z'));
    checkRateLimit('second', { windowMs: 1_000, maxRequests: 1 });

    expect(_getRateLimitBucketSizeForTests()).toBe(1);
  });

  it('caps the total bucket count to avoid unbounded growth', () => {
    for (let index = 0; index < 10_500; index += 1) {
      checkRateLimit(`ip-${index}`, { windowMs: 60_000, maxRequests: 1 });
    }

    expect(_getRateLimitBucketSizeForTests()).toBeLessThanOrEqual(10_000);
  });
});
