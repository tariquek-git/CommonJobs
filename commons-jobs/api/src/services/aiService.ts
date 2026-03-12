import { GoogleGenAI, Type } from '@google/genai';

const compact = (value: string): string => value.replace(/\s+/g, ' ').trim();

const humanizeSummary = (value: string): string => {
  const cleaned = compact(value)
    .replace(/\bleverage\b/gi, 'use')
    .replace(/\butilize\b/gi, 'use')
    .replace(/\bsynerg(?:y|ize)\b/gi, 'work together')
    .replace(/\brobust\b/gi, 'strong')
    .replace(/\bdynamic\b/gi, 'fast-moving')
    .replace(/\bmission[- ]critical\b/gi, 'important')
    .replace(/\bworld[- ]class\b/gi, 'high quality')
    .replace(/\bcutting[- ]edge\b/gi, 'modern')
    .replace(/\bbest[- ]in[- ]class\b/gi, 'strong')
    .replace(/\binnovative\b/gi, 'practical')
    .replace(/\bimpactful\b/gi, 'useful')
    .replace(/\bhighly scalable\b/gi, 'scalable')
    .replace(/\bfast[- ]paced\b/gi, 'busy')
    .replace(/\bcross[- ]functional\b/gi, 'cross-team')
    .replace(/\bstakeholders?\b/gi, 'teams')
    .replace(/\bdrive\b/gi, 'lead')
    .replace(/\bchampion\b/gi, 'support')
    .replace(/\broadmap execution\b/gi, 'shipping work');

  return cleaned.slice(0, 900);
};

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
  return humanizeSummary(sentences.slice(0, 5).join(' '));
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

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
};

const SEARCH_DATE_RANGES = new Set(['all', '24h', '7d', '30d']);
const SEARCH_REMOTE_POLICIES = new Set(['Onsite', 'Hybrid', 'Remote']);
const SEARCH_EMPLOYMENT_TYPES = new Set(['Full-time', 'Contract', 'Internship']);
const SEARCH_SENIORITY_LEVELS = new Set(['Junior', 'Mid-Level', 'Senior', 'Lead', 'Executive']);
const PARSE_CACHE_TTL_MS = 5 * 60 * 1000;

const normalizeSearchEnumArray = (
  value: unknown,
  allowed: Set<string>,
  aliases?: Record<string, string>
): string[] => {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const normalizedAlias = aliases?.[trimmed.toLowerCase()] ?? trimmed;
    if (allowed.has(normalizedAlias) && !out.includes(normalizedAlias)) {
      out.push(normalizedAlias);
    }
  }
  return out;
};

const extractResponseText = (response: unknown): string => {
  if (!response || typeof response !== 'object') return '';

  const textValue = (response as { text?: unknown }).text;
  if (typeof textValue === 'string' && textValue.trim()) {
    return textValue;
  }

  const candidates = (response as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return '';

  const chunks: string[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const content = (candidate as { content?: unknown }).content;
    if (!content || typeof content !== 'object') continue;
    const parts = (content as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      const partText = (part as { text?: unknown }).text;
      if (typeof partText === 'string' && partText.trim()) {
        chunks.push(partText);
      }
    }
  }
  return chunks.join('\n');
};

const normalizeSearchParseResult = (raw: Record<string, unknown>, originalQuery: string) => {
  const source =
    raw.filters && typeof raw.filters === 'object'
      ? (raw.filters as Record<string, unknown>)
      : raw;

  const keyword = typeof source.keyword === 'string' && source.keyword.trim() ? source.keyword.trim() : compact(originalQuery);
  const dateRangeRaw = typeof source.dateRange === 'string' ? source.dateRange.trim() : 'all';
  const dateRange = SEARCH_DATE_RANGES.has(dateRangeRaw) ? dateRangeRaw : 'all';

  const remotePolicies = normalizeSearchEnumArray(source.remotePolicies, SEARCH_REMOTE_POLICIES, {
    onsite: 'Onsite',
    'on-site': 'Onsite',
    'on site': 'Onsite',
    hybrid: 'Hybrid',
    remote: 'Remote'
  });
  const employmentTypes = normalizeSearchEnumArray(source.employmentTypes, SEARCH_EMPLOYMENT_TYPES, {
    fulltime: 'Full-time',
    'full-time': 'Full-time',
    contract: 'Contract',
    internship: 'Internship',
    intern: 'Internship'
  });
  const seniorityLevels = normalizeSearchEnumArray(source.seniorityLevels, SEARCH_SENIORITY_LEVELS, {
    junior: 'Junior',
    mid: 'Mid-Level',
    'mid-level': 'Mid-Level',
    intermediate: 'Mid-Level',
    senior: 'Senior',
    lead: 'Lead',
    staff: 'Lead',
    principal: 'Lead',
    executive: 'Executive',
    director: 'Executive',
    vp: 'Executive'
  });

  return {
    keyword,
    remotePolicies,
    employmentTypes,
    seniorityLevels,
    dateRange
  };
};

export const createAiService = (apiKey?: string, model = 'gemini-flash-latest', timeoutMs = 8000) => {
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  const fallbackModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
  const candidateModels = [model, ...fallbackModels].filter((value, index, list) => !!value && list.indexOf(value) === index);
  const parseSearchCache = new Map<string, { at: number; value: Record<string, unknown> }>();

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

  const generateJson = async (
    contents: string,
    responseSchema?: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> => {
    if (!ai) return null;

    let lastError: unknown = null;

    for (const candidateModel of candidateModels) {
      try {
        const config: Record<string, unknown> = {
          responseMimeType: 'application/json'
        };
        if (responseSchema) {
          config.responseSchema = responseSchema;
        }

        const response = await withTimeout(
          ai.models.generateContent({
            model: candidateModel,
            contents,
            config
          }),
          timeoutMs
        );

        const responseText = extractResponseText(response);
        if (!responseText) {
          continue;
        }

        const parsed = safeJsonParse<Record<string, unknown>>(responseText);
        if (parsed) {
          return parsed;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    return null;
  };

  const analyzeJobDescription = async (description: string) => {
    if (!ai || !description.trim()) return null;

    const parsed = await generateJson(
      [
        'Extract structured metadata from this job post.',
        'Write summary as a real person would explain it to a friend.',
        'Summary length: 4-6 sentences (about 90-150 words).',
        'Use plain language and concrete details from the JD.',
        'Avoid corporate buzzwords, jargon, hype, or generic filler.',
        'No phrases like "world-class", "leverage", "cutting-edge", "mission-critical", or "dynamic environment".',
        'Explain what they will actually do day to day, who they work with, and what success looks like.',
        '',
        description.slice(0, 8000)
      ].join('\n'),
      {
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
    );
    if (!parsed) return null;
    const summary = typeof parsed.summary === 'string' ? humanizeSummary(parsed.summary) : '';
    return {
      ...parsed,
      summary
    };
  };

  const parseSearchQuery = async (query: string) => {
    if (!ai || !query.trim()) return null;
    const normalizedQuery = compact(query).toLowerCase();
    const cached = parseSearchCache.get(normalizedQuery);
    if (cached && Date.now() - cached.at < PARSE_CACHE_TTL_MS) {
      return cached.value;
    }

    const prompt = [
      [
        'Translate this job search query into filter JSON.',
        'Return JSON only (no markdown).',
        'Use these enums:',
        '- dateRange: "all" | "24h" | "7d" | "30d"',
        '- remotePolicies: ["Onsite" | "Hybrid" | "Remote"]',
        '- employmentTypes: ["Full-time" | "Contract" | "Internship"]',
        '- seniorityLevels: ["Junior" | "Mid-Level" | "Senior" | "Lead" | "Executive"]',
        'If a value is unknown, return an empty array and dateRange "all".',
        'Never include extra keys.',
        '',
        `Query: ${query}`
      ].join('\n'),
    ];
    const schema = {
      type: Type.OBJECT,
      properties: {
        keyword: { type: Type.STRING },
        remotePolicies: { type: Type.ARRAY, items: { type: Type.STRING } },
        employmentTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
        seniorityLevels: { type: Type.ARRAY, items: { type: Type.STRING } },
        dateRange: { type: Type.STRING }
      }
    };

    let parsed = await generateJson(prompt.join('\n'), schema);
    if (!parsed) {
      // Retry without schema because some model/runtime combinations intermittently drop schema-formatted JSON.
      parsed = await generateJson(prompt.join('\n'));
    }
    if (!parsed) return null;

    const normalized = normalizeSearchParseResult(parsed, query);
    parseSearchCache.set(normalizedQuery, { at: Date.now(), value: normalized });
    return normalized;
  };

  return { analyzeJobDescription, parseSearchQuery };
};
