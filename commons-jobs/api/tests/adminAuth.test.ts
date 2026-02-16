import { describe, expect, it } from 'vitest';
import { createAdminToken, verifyAdminToken } from '../src/auth/adminAuth.js';

describe('admin auth token', () => {
  const secret = '12345678901234567890123456789012';

  it('verifies a valid token', () => {
    const token = createAdminToken(secret, 60_000);
    expect(verifyAdminToken(token, secret)).toBe(true);
  });

  it('rejects an expired token', async () => {
    const token = createAdminToken(secret, 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(verifyAdminToken(token, secret)).toBe(false);
  });

  it('rejects a token signed with a different secret', () => {
    const token = createAdminToken(secret, 60_000);
    expect(verifyAdminToken(token, 'different-secret-123456789012345')).toBe(false);
  });
});
