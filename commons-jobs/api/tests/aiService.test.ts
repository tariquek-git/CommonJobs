import { describe, expect, it, vi } from 'vitest';

const generateContentMock = vi.fn(async () => ({ text: '{}' }));
const googleGenAIMock = vi.fn(() => ({
  models: {
    generateContent: generateContentMock
  }
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: googleGenAIMock,
  Type: {
    OBJECT: 'object',
    STRING: 'string',
    ARRAY: 'array'
  }
}));

describe('createAiService', () => {
  it('uses the configured model when calling Gemini', async () => {
    const { createAiService } = await import('../src/services/aiService.js');
    const service = createAiService('fake-key', 'gemini-flash-latest');

    await service.analyzeJobDescription('Some job description.');

    expect(generateContentMock).toHaveBeenCalled();
    const call = (generateContentMock.mock.calls as any[])[0]?.[0] as { model?: string };
    expect(call.model).toBe('gemini-flash-latest');
  });

  it('parses JSON even if wrapped with extra text', async () => {
    generateContentMock.mockResolvedValueOnce({
      text: 'Here you go:\\n```json\\n{\"keyword\":\"backend\",\"remotePolicies\":[\"Remote\"]}\\n```'
    });

    const { createAiService } = await import('../src/services/aiService.js');
    const service = createAiService('fake-key', 'gemini-flash-latest');
    const result = await service.parseSearchQuery('remote backend');

    expect(result).toEqual({ keyword: 'backend', remotePolicies: ['Remote'] });
  });

  it('builds heuristic job analysis from plain text', async () => {
    const { heuristicAnalyzeJobDescription } = await import('../src/services/aiService.js');
    const result = heuristicAnalyzeJobDescription(
      'Wealthsimple is hiring a Senior Product Manager in Toronto, Canada. This is a hybrid full-time role.'
    );

    expect(result.companyName).toBe('Wealthsimple');
    expect(result.roleTitle).toContain('Senior Product Manager');
    expect(result.locationCity).toBe('Toronto');
    expect(result.locationCountry).toBe('Canada');
    expect(result.remotePolicy).toBe('Hybrid');
    expect(result.employmentType).toBe('Full-time');
  });

  it('builds heuristic search filters from text query', async () => {
    const { heuristicParseSearchQuery } = await import('../src/services/aiService.js');
    const result = heuristicParseSearchQuery('remote senior backend jobs last 24 hours');

    expect(result.remotePolicies).toContain('Remote');
    expect(result.seniorityLevels).toContain('Senior');
    expect(result.dateRange).toBe('24h');
  });
});
