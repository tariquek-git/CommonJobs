import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';

const baseEnv = {
  PORT: '4010',
  DATA_FILE: 'data/jobs.json',
  CLIENT_ORIGIN: 'http://localhost:5173',
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX_SUBMIT: '20',
  RATE_LIMIT_MAX_ADMIN_LOGIN: '30'
};

describe('parseEnv', () => {
  it('rejects production config when default admin secrets are used', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        NODE_ENV: 'production'
      })
    ).toThrow('ADMIN_PASSWORD must be set to a non-default value in production');
  });

  it('accepts production config with non-default admin secrets', () => {
    const parsed = parseEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      ADMIN_PASSWORD: 'strong-admin-password-2026',
      ADMIN_TOKEN_SECRET: 'super-long-token-secret-for-production-2026'
    });

    expect(parsed.NODE_ENV).toBe('production');
    expect(parsed.ADMIN_PASSWORD).toBe('strong-admin-password-2026');
  });
});
