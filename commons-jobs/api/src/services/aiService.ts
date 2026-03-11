type JsonSchema = {
  type: 'OBJECT' | 'ARRAY' | 'STRING';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 12_000;

const parseGeminiJson = (payload: GeminiResponse): Record<string, unknown> | null => {
  const textPart = payload.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
  if (!textPart) return null;

  try {
    const parsed = JSON.parse(textPart);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const requestGeminiJson = async (
  apiKey: string,
  prompt: string,
  schema: JsonSchema
): Promise<Record<string, unknown> | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema
          }
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) return null;
    const payload = (await response.json()) as GeminiResponse;
    return parseGeminiJson(payload);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const createAiService = (apiKey?: string) => {
  const analyzeJobDescription = async (description: string) => {
    if (!apiKey || !description.trim()) return null;

    return requestGeminiJson(
      apiKey,
      `Extract structured job metadata and a concise summary from this posting:\n\n${description.slice(0, 8000)}`,
      {
        type: 'OBJECT',
        properties: {
          roleTitle: { type: 'STRING' },
          companyName: { type: 'STRING' },
          summary: { type: 'STRING' },
          locationCity: { type: 'STRING' },
          locationState: { type: 'STRING' },
          locationCountry: { type: 'STRING' },
          remotePolicy: { type: 'STRING' },
          employmentType: { type: 'STRING' },
          seniority: { type: 'STRING' },
          salaryRange: { type: 'STRING' },
          currency: { type: 'STRING' },
          tags: { type: 'ARRAY', items: { type: 'STRING' } }
        }
      }
    );
  };

  const parseSearchQuery = async (query: string) => {
    if (!apiKey || !query.trim()) return null;

    return requestGeminiJson(
      apiKey,
      `Translate this job search query to filter JSON: ${query}`,
      {
        type: 'OBJECT',
        properties: {
          keyword: { type: 'STRING' },
          remotePolicies: { type: 'ARRAY', items: { type: 'STRING' } },
          employmentTypes: { type: 'ARRAY', items: { type: 'STRING' } },
          seniorityLevels: { type: 'ARRAY', items: { type: 'STRING' } },
          dateRange: { type: 'STRING' }
        }
      }
    );
  };

  return { analyzeJobDescription, parseSearchQuery };
};
