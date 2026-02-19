// Browser-safe default for Vercel: API routes are served under /api.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface ParsedSearchFilters {
  keyword?: string;
  remotePolicies?: string[];
  employmentTypes?: string[];
  seniorityLevels?: string[];
  dateRange?: 'all' | '24h' | '7d' | '30d';
}

export interface AiEndpointResult<T> {
  result: T | null;
  fallback: boolean;
}

const postJson = async <T>(path: string, payload: unknown): Promise<T | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export const analyzeJobDescription = async (description: string) => {
  const payload = await postJson<AiEndpointResult<Record<string, unknown>>>('/ai/analyze-job', { description });
  if (!payload) return null;
  return {
    result: payload.result || null,
    fallback: Boolean(payload.fallback)
  };
};

export const parseSearchQuery = async (query: string) => {
  const payload = await postJson<AiEndpointResult<ParsedSearchFilters>>('/ai/parse-search', { query });
  if (!payload) return null;
  return {
    result: payload.result || null,
    fallback: Boolean(payload.fallback)
  };
};
