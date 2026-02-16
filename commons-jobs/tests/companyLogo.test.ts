import { describe, expect, it } from 'vitest';
import { getCompanyLogoUrl } from '../utils/companyLogo';

describe('getCompanyLogoUrl', () => {
  it('builds a logo url from company website', () => {
    expect(getCompanyLogoUrl('https://www.stripe.com', '')).toBe('https://www.google.com/s2/favicons?domain=stripe.com&sz=64');
  });

  it('falls back to external link when company website is missing', () => {
    expect(getCompanyLogoUrl(undefined, 'jobs.example.com/apply')).toBe('https://www.google.com/s2/favicons?domain=jobs.example.com&sz=64');
  });

  it('returns null for malformed urls', () => {
    expect(getCompanyLogoUrl('://not-a-url', '')).toBeNull();
  });
});
