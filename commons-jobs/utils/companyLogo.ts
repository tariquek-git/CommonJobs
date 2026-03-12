const JOB_BOARD_HOSTS = [
  'greenhouse.io',
  'boards.greenhouse.io',
  'lever.co',
  'jobs.lever.co',
  'myworkdayjobs.com',
  'workday.com',
  'smartrecruiters.com',
  'ashbyhq.com',
  'jobvite.com',
  'breezy.hr',
  'icims.com',
  'taleo.net',
  'indeed.com',
  'linkedin.com'
];

const normalizeHostname = (targetUrl?: string): string | null => {
  if (!targetUrl) return null;
  try {
    const normalizedUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
    const hostname = new URL(normalizedUrl).hostname.replace(/^www\./, '').toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
};

const isPlaceholderHostname = (hostname: string): boolean =>
  hostname === 'example.com' ||
  hostname.endsWith('.example.com') ||
  hostname === 'localhost' ||
  hostname.endsWith('.local');

const isJobBoardHostname = (hostname: string): boolean =>
  JOB_BOARD_HOSTS.some((entry) => hostname === entry || hostname.endsWith(`.${entry}`));

const resolveLogoHostname = (companyWebsite?: string, externalLink?: string): string | null => {
  const companyHost = normalizeHostname(companyWebsite);
  if (companyHost && !isPlaceholderHostname(companyHost)) {
    return companyHost;
  }

  const externalHost = normalizeHostname(externalLink);
  if (!externalHost || isPlaceholderHostname(externalHost) || isJobBoardHostname(externalHost)) {
    return null;
  }

  return externalHost;
};

export const getCompanyLogoCandidates = (companyWebsite?: string, externalLink?: string): string[] => {
  const hostname = resolveLogoHostname(companyWebsite, externalLink);
  if (!hostname) return [];

  return [
    `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`
  ];
};

export const getCompanyLogoUrl = (companyWebsite?: string, externalLink?: string): string | null =>
  getCompanyLogoCandidates(companyWebsite, externalLink)[0] ?? null;
