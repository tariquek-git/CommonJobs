const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export const sanitizeText = (value: unknown, maxLength = 500): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

export const sanitizeOptionalUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const candidate = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
};

export const sanitizeTags = (tags: unknown): string[] | undefined => {
  if (!Array.isArray(tags)) return undefined;
  const clean = tags
    .map((tag) => sanitizeText(tag, 32))
    .filter((tag): tag is string => Boolean(tag));

  if (clean.length === 0) return undefined;
  return Array.from(new Set(clean)).slice(0, 8);
};
