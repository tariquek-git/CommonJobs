import { GoogleGenAI, Type } from '@google/genai';
export const createAiService = (apiKey?: string) => {
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  const analyzeJobDescription = async (description: string) => {
    if (!ai || !description.trim()) return null;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
      return JSON.parse(response.text);
    } catch {
      return null;
    }
  };

  const parseSearchQuery = async (query: string) => {
    if (!ai || !query.trim()) return null;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate this job search query to filter JSON: ${query}`,
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
      return JSON.parse(response.text);
    } catch {
      return null;
    }
  };

  return { analyzeJobDescription, parseSearchQuery };
};
