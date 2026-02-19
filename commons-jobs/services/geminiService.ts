import { requestJson } from './apiClient';

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

export const analyzeJobDescription = async (description: string) => {
  try {
    const payload = await requestJson<AiEndpointResult<Record<string, unknown>>>('/ai/analyze-job', {
      method: 'POST',
      body: { description }
    });
    return {
      result: payload.result || null,
      fallback: Boolean(payload.fallback)
    };
  } catch {
    return null;
  }
};

export const parseSearchQuery = async (query: string) => {
  try {
    const payload = await requestJson<AiEndpointResult<ParsedSearchFilters>>('/ai/parse-search', {
      method: 'POST',
      body: { query }
    });
    return {
      result: payload.result || null,
      fallback: Boolean(payload.fallback)
    };
  } catch {
    return null;
  }
};
