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
    const call = generateContentMock.mock.calls[0]?.[0] as { model?: string };
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
});
