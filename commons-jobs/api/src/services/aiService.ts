import { GoogleGenAI, Type } from '@google/genai';

const compact = (value: string): string => value.replace(/\s+/g, ' ').trim();

const inferRemotePolicy = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.includes('hybrid')) return 'Hybrid';
  if (lower.includes('remote')) return 'Remote';
  if (lower.includes('onsite') || lower.includes('on-site') || lower.includes('on site')) return 'Onsite';
  return '';
};

const inferEmploymentType = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.includes('full-time') || lower.includes('full time')) return 'Full-time';
  if (lower.includes('contract')) return 'Contract';
  if (lower.includes('intern')) return 'Internship';
  return '';
};

const inferSeniority = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.includes('executive') || lower.includes('director') || lower.includes('vp')) return 'Executive';
  if (lower.includes('lead') || lower.includes('principal') || lower.includes('staff')) return 'Lead';
  if (lower.includes('senior') || lower.includes('sr.')) return 'Senior';
  if (lower.includes('mid-level') || lower.includes('mid level') || lower.includes('intermediate')) return 'Mid-Level';
  if (lower.includes('junior') || lower.includes('jr.')) return 'Junior';
  return '';
};

const inferTags = (text: string): string[] => {
  const tags: string[] = [];
  const tagMatchers: Array<[string, RegExp]> = [
    ['Payments', /\bpayments?\b/i],
    ['Risk', /\brisk\b/i],
    ['Compliance', /\bcompliance\b/i],
    ['Product', /\bproduct\b/i],
    ['Engineering', /\bengineer|engineering\b/i],
    ['Analytics', /\banalytics?|analysis\b/i],
    ['Fintech', /\bfintech\b/i],
    ['SQL', /\bsql\b/i],
    ['API', /\bapi(s)?\b/i]
  ];

  for (const [label, pattern] of tagMatchers) {
    if (pattern.test(text)) tags.push(label);
  }

  return tags.slice(0, 8);
};

const buildSummary = (description: string): string => {
  const cleaned = compact(description);
  if (!cleaned) return '';
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  return compact(sentences.slice(0, 2).join(' ').slice(0, 360));
};

export const heuristicAnalyzeJobDescription = (description: string) => {
  const cleaned = compact(description);
  const locationMatch = cleaned.match(/\bin\s+([A-Za-z .'-]+),\s*([A-Za-z .'-]+?)(?:[.!?,;\n]|$)/i);
  const hiringMatch = cleaned.match(/^([A-Za-z0-9& .'-]{2,80})\s+is hiring\s+(?:an?\s+)?([^.,\n]+)/i);

  const roleTitle = hiringMatch?.[2]?.trim() || '';
  const companyName = hiringMatch?.[1]?.trim() || '';
  const locationCity = locationMatch?.[1]?.trim() || '';
  const locationCountry = locationMatch?.[2]?.trim() || '';

  return {
    roleTitle,
    companyName,
    summary: buildSummary(cleaned),
    locationCity,
    locationState: '',
    locationCountry,
    remotePolicy: inferRemotePolicy(cleaned),
    employmentType: inferEmploymentType(cleaned),
    seniority: inferSeniority(cleaned),
    salaryRange: '',
    currency: '',
    tags: inferTags(cleaned)
  };
};

export const heuristicParseSearchQuery = (query: string) => {
  const cleaned = compact(query);
  const lower = cleaned.toLowerCase();

  const remotePolicies: string[] = [];
  if (lower.includes('remote')) remotePolicies.push('Remote');
  if (lower.includes('hybrid')) remotePolicies.push('Hybrid');
  if (lower.includes('onsite') || lower.includes('on-site') || lower.includes('on site')) remotePolicies.push('Onsite');

  const employmentTypes: string[] = [];
  if (lower.includes('full-time') || lower.includes('full time')) employmentTypes.push('Full-time');
  if (lower.includes('contract')) employmentTypes.push('Contract');
  if (lower.includes('intern')) employmentTypes.push('Internship');

  const seniorityLevels: string[] = [];
  if (lower.includes('junior') || lower.includes('jr')) seniorityLevels.push('Junior');
  if (lower.includes('mid')) seniorityLevels.push('Mid-Level');
  if (lower.includes('senior') || lower.includes('sr')) seniorityLevels.push('Senior');
  if (lower.includes('lead') || lower.includes('principal') || lower.includes('staff')) seniorityLevels.push('Lead');
  if (lower.includes('executive') || lower.includes('director') || lower.includes('vp')) seniorityLevels.push('Executive');

  let dateRange = 'all';
  if (/\b(today|24h|last 24 hours)\b/i.test(lower)) dateRange = '24h';
  else if (/\b(7d|7 days|week)\b/i.test(lower)) dateRange = '7d';
  else if (/\b(30d|30 days|month)\b/i.test(lower)) dateRange = '30d';

  return {
    keyword: cleaned,
    remotePolicies,
    employmentTypes,
    seniorityLevels,
    dateRange
  };
};

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
