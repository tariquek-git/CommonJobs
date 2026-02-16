const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4010';

export interface ParsedSearchFilters {
  keyword?: string;
  remotePolicies?: string[];
  employmentTypes?: string[];
  seniorityLevels?: string[];
  dateRange?: 'all' | '24h' | '7d' | '30d';
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
  const result = await postJson<{ result: unknown }>('/ai/analyze-job', { description });
  return result?.result || null;
};

export const parseSearchQuery = async (query: string) => {
  const result = await postJson<{ result: ParsedSearchFilters | null }>('/ai/parse-search', { query });
  return result?.result || null;
};
