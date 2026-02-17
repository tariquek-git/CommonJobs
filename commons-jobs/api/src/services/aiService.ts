import { GoogleGenAI, Type } from '@google/genai';
export const createAiService = (apiKey?: string, model = 'gemini-flash-latest') => {
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  const safeJsonParse = <T>(text: string): T | null => {
    try {
      return JSON.parse(text) as T;
    } catch {
      // Some models occasionally wrap JSON in prose or markdown despite mime/schema hints.
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1)) as T;
        } catch {
          return null;
        }
      }
      return null;
    }
  };

  const analyzeJobDescription = async (description: string) => {
    if (!ai || !description.trim()) return null;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: `Extract structured job metadata and a concise summary from this posting:\n\n${description.slice(0, 8000)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              roleTitle: { type: Type.STRING },
              companyName: { type: Type.STRING },
              summary: { type: Type.STRING },
              locationCity: { type: Type.STRING },
              locationState: { type: Type.STRING },
              locationCountry: { type: Type.STRING },
              remotePolicy: { type: Type.STRING },
              employmentType: { type: Type.STRING },
              seniority: { type: Type.STRING },
              salaryRange: { type: Type.STRING },
              currency: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });

      if (!response.text) return null;
      return safeJsonParse(response.text);
    } catch {
      return null;
    }
  };

  const parseSearchQuery = async (query: string) => {
    if (!ai || !query.trim()) return null;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          'Translate this job search query into filter JSON.',
          'Return JSON only (no markdown).',
          'Use these enums:',
          '- dateRange: "all" | "24h" | "7d" | "30d"',
          '- remotePolicies: ["Onsite" | "Hybrid" | "Remote"]',
          '- employmentTypes: ["Full-time" | "Contract" | "Internship"]',
          '- seniorityLevels: ["Junior" | "Mid-Level" | "Senior" | "Lead" | "Executive"]',
          '',
          `Query: ${query}`
        ].join('\n'),
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              keyword: { type: Type.STRING },
              remotePolicies: { type: Type.ARRAY, items: { type: Type.STRING } },
              employmentTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
              seniorityLevels: { type: Type.ARRAY, items: { type: Type.STRING } },
              dateRange: { type: Type.STRING }
            }
          }
        }
      });

      if (!response.text) return null;
      return safeJsonParse(response.text);
    } catch {
      return null;
    }
  };

  return { analyzeJobDescription, parseSearchQuery };
};
