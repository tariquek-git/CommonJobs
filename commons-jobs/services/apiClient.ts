export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiClientError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.payload = payload;
  }
}

type JsonMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type ApiRequestOptions = {
  method?: JsonMethod;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  token?: string;
  keepalive?: boolean;
  // Retry is applied only for safe reads (GET/HEAD) and transient failures.
  retry?: number;
  retryDelayMs?: number;
};

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const SAFE_METHODS = new Set(['GET', 'HEAD']);

const delay = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const extractErrorMessage = (status: number, payload: unknown): string => {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return `Request failed (${status})`;
};

const shouldRetry = (method: string, attempt: number, maxRetries: number, errorOrStatus: unknown): boolean => {
  if (!SAFE_METHODS.has(method)) return false;
  if (attempt >= maxRetries) return false;
  if (typeof errorOrStatus === 'number') return RETRYABLE_STATUS.has(errorOrStatus);
  return true; // Network errors on safe reads.
};

export const requestJson = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const method = options.method || 'GET';
  const maxRetries = Math.max(0, options.retry ?? 0);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 200);

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        signal: options.signal,
        keepalive: options.keepalive,
        headers: {
          'Content-Type': 'application/json',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(options.headers || {})
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });

      const payload = await parseJson(response);
      if (!response.ok) {
        if (shouldRetry(method, attempt, maxRetries, response.status)) {
          await delay(retryDelayMs * (attempt + 1));
          continue;
        }
        throw new ApiClientError(extractErrorMessage(response.status, payload), response.status, payload);
      }

      return payload as T;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      if (shouldRetry(method, attempt, maxRetries, error)) {
        await delay(retryDelayMs * (attempt + 1));
        continue;
      }
      throw new ApiClientError('Network request failed', 0, null);
    }
  }
};

export const requestVoid = async (path: string, options: ApiRequestOptions = {}): Promise<void> => {
  await requestJson<Record<string, unknown>>(path, options);
};
