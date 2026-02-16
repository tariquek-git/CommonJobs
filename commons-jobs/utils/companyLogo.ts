export const getCompanyLogoUrl = (companyWebsite?: string, externalLink?: string): string | null => {
  const targetUrl = companyWebsite || externalLink;
  if (!targetUrl) return null;

  try {
    const normalizedUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
    const hostname = new URL(normalizedUrl).hostname.replace(/^www\./, '');
    if (!hostname) return null;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return null;
  }
};
