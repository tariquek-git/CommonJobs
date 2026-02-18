import { FEEDBACK_EMAIL } from '../siteConfig';

type FeedbackContext = {
  pageUrl?: string;
  jobId?: string;
  submissionId?: string;
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
    '',
    'Device/Browser (e.g., iPhone Safari):'
  ];

  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
};

