import { describe, expect, it } from 'vitest';
import { getCompanyLogoCandidates, getCompanyLogoUrl } from '../utils/companyLogo';

describe('getCompanyLogoUrl', () => {
  it('builds a logo url from company website', () => {
    expect(getCompanyLogoUrl('https://www.stripe.com', '')).toBe('https://www.google.com/s2/favicons?domain=stripe.com&sz=128');
  });

  it('returns google favicon candidates for reliability', () => {
    expect(getCompanyLogoCandidates('https://www.stripe.com', '')).toEqual([
      'https://www.google.com/s2/favicons?domain=stripe.com&sz=128'
    ]);
  });

  it('ignores job-board hosts when company website is missing', () => {
    expect(getCompanyLogoUrl(undefined, 'https://jobs.lever.co/wealthsimple/123')).toBeNull();
  });

  it('falls back to external link only for non-job-board domains', () => {
    expect(getCompanyLogoUrl(undefined, 'https://careers.stripe.com/openings')).toBe('https://www.google.com/s2/favicons?domain=careers.stripe.com&sz=128');
  });

  it('returns null for placeholder domains to avoid noisy 404 logo requests', () => {
    expect(getCompanyLogoUrl(undefined, 'jobs.example.com/apply')).toBeNull();
  });

  it('returns null for malformed urls', () => {
    expect(getCompanyLogoUrl('://not-a-url', '')).toBeNull();
  });
});
