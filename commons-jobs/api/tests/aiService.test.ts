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
    const service = createAiService('fake-key', 'gemini-1.5-flash');

    await service.analyzeJobDescription('Some job description.');

    expect(generateContentMock).toHaveBeenCalled();
    const call = generateContentMock.mock.calls[0]?.[0] as { model?: string };
    expect(call.model).toBe('gemini-1.5-flash');
  });
});

