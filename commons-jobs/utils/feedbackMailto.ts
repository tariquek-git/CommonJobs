import { FEEDBACK_EMAIL } from '../siteConfig';

type FeedbackContext = {
  pageUrl?: string;
  jobId?: string;
  submissionId?: string;
  feedType?: 'direct' | 'aggregated';
  sort?: string;
  keyword?: string;
  activeFilters?: string[];
};

const line = (label: string, value?: string): string => `${label}: ${value || ''}`;

export const buildFeedbackMailto = (ctx: FeedbackContext = {}): string => {
  const subject = 'Commons Jobs beta feedback';
  const bodyLines = [
    'What happened?',
    '',
    'What did you expect?',
    '',
    'Steps to reproduce:',
    '1.',
    '2.',
    '3.',
    '',
    line('Page URL', ctx.pageUrl),
    line('Job ID', ctx.jobId),
    line('Submission/Reference ID', ctx.submissionId),
    line('Feed', ctx.feedType),
    line('Sort', ctx.sort),
    line('Keyword', ctx.keyword),
    line('Active filters', ctx.activeFilters && ctx.activeFilters.length > 0 ? ctx.activeFilters.join(', ') : undefined),
    '',
    'Device/Browser (e.g., iPhone Safari):'
  ];

  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
};
