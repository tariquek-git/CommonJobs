import { describe, expect, it } from 'vitest';
import { getCompanyLogoUrl } from '../utils/companyLogo';

describe('getCompanyLogoUrl', () => {
  it('builds a logo url from company website', () => {
    expect(getCompanyLogoUrl('https://www.stripe.com', '')).toBe('https://www.google.com/s2/favicons?domain=stripe.com&sz=64');
  });

  it('falls back to external link when company website is missing', () => {
    expect(getCompanyLogoUrl(undefined, 'https://jobs.lever.co/wealthsimple/123')).toBe('https://www.google.com/s2/favicons?domain=jobs.lever.co&sz=64');
  });

  it('returns null for placeholder domains to avoid noisy 404 logo requests', () => {
    expect(getCompanyLogoUrl(undefined, 'jobs.example.com/apply')).toBeNull();
  });

  it('returns null for malformed urls', () => {
    expect(getCompanyLogoUrl('://not-a-url', '')).toBeNull();
  });
});
