import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    generateContentMock.mockReset();
    generateContentMock.mockResolvedValue({ text: '{}' });
  });

  it('uses the configured model when calling Gemini', async () => {
    const { createAiService } = await import('../src/services/aiService.js');
    const service = createAiService('fake-key', 'gemini-flash-latest');

    await service.analyzeJobDescription('Some job description.');

    expect(generateContentMock).toHaveBeenCalled();
    const call = (generateContentMock.mock.calls as any[])[0]?.[0] as { model?: string };
    expect(call.model).toBe('gemini-flash-latest');
  });

  it('falls back to backup Gemini models when the configured model fails', async () => {
    generateContentMock
      .mockRejectedValueOnce(new Error('model not found'))
      .mockResolvedValueOnce({
        text: JSON.stringify({
          roleTitle: 'Risk Engineer',
          companyName: 'Acme',
          summary: 'You will build risk controls with product and engineering.'
        })
      });

    const { createAiService } = await import('../src/services/aiService.js');
    const service = createAiService('fake-key', 'gemini-flash-latest');
    const result = await service.analyzeJobDescription('Acme is hiring a risk engineer in Toronto, Canada.');

    expect(result?.companyName).toBe('Acme');
    expect(generateContentMock).toHaveBeenCalledTimes(2);
    const secondCall = (generateContentMock.mock.calls as any[])[1]?.[0] as { model?: string };
    expect(secondCall.model).toBe('gemini-2.5-flash');
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

  it('returns null when Gemini analysis exceeds timeout', async () => {
    generateContentMock.mockImplementation(() => new Promise(() => undefined));

    const { createAiService } = await import('../src/services/aiService.js');
    const service = createAiService('fake-key', 'gemini-flash-latest', 5);
    const result = await service.analyzeJobDescription('Very long description that may time out');

    expect(result).toBeNull();
  });

  it('normalizes AI summary to plain human language', async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        roleTitle: 'Staff Engineer',
        companyName: 'Acme',
        summary:
          'You will leverage robust systems to synergize teams and utilize cross-functional workflows in a mission-critical environment.'
      })
    });

    const { createAiService } = await import('../src/services/aiService.js');
    const service = createAiService('fake-key', 'gemini-flash-latest', 5000);
    const result = await service.analyzeJobDescription('Acme is hiring');

    expect(result?.summary).toContain('use');
    expect(result?.summary).not.toContain('leverage');
    expect(result?.summary).not.toContain('utilize');
    expect(result?.summary).not.toContain('synergize');
    expect(result?.summary).not.toContain('mission-critical');
  });

  it('keeps longer humanized summaries instead of forcing a short 2-sentence cap', async () => {
    const longSummary =
      'You will lead product planning for cards and payments across Canada. ' +
      'Each week you will work with design, engineering, and risk to shape features. ' +
      'You will write clear specs, answer open questions, and unblock delivery decisions. ' +
      'You will review metrics after launch and adjust based on user behavior. ' +
      'You will partner with support and operations to keep the experience reliable.';

    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        roleTitle: 'Senior Product Manager',
        companyName: 'Acme',
        summary: longSummary
      })
    });

    const { createAiService } = await import('../src/services/aiService.js');
    const service = createAiService('fake-key', 'gemini-flash-latest', 5000);
    const result = await service.analyzeJobDescription('Acme is hiring');

    expect(result?.summary.length || 0).toBeGreaterThan(360);
    expect(result?.summary.length || 0).toBeLessThanOrEqual(900);
    expect(result?.summary).toContain('Each week you will work with design');
  });
});
