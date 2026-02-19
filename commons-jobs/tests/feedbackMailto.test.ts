import { describe, expect, it } from 'vitest';
import { buildFeedbackMailto } from '../utils/feedbackMailto';

describe('buildFeedbackMailto', () => {
  it('includes context values in the generated mail body', () => {
    const href = buildFeedbackMailto({
      pageUrl: 'https://fintechcommons.com/?feed=aggregated',
      jobId: 'job-123',
      submissionId: 'sub-456',
      feedType: 'aggregated',
      sort: 'newest',
      keyword: 'risk engineer',
      activeFilters: ['Remote', 'Senior']
    });

    const decoded = decodeURIComponent(href);
    expect(decoded).toContain('mailto:');
    expect(decoded).toContain('Page URL: https://fintechcommons.com/?feed=aggregated');
    expect(decoded).toContain('Job ID: job-123');
    expect(decoded).toContain('Submission/Reference ID: sub-456');
    expect(decoded).toContain('Feed: aggregated');
    expect(decoded).toContain('Sort: newest');
    expect(decoded).toContain('Keyword: risk engineer');
    expect(decoded).toContain('Active filters: Remote, Senior');
  });

  it('keeps empty context lines when optional values are missing', () => {
    const decoded = decodeURIComponent(buildFeedbackMailto());
    expect(decoded).toContain('Feed: ');
    expect(decoded).toContain('Sort: ');
    expect(decoded).toContain('Keyword: ');
    expect(decoded).toContain('Active filters: ');
  });
});
