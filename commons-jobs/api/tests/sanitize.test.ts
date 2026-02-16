import { describe, expect, it } from 'vitest';
import { sanitizeOptionalUrl, sanitizeTags, sanitizeText } from '../src/lib/sanitize.js';

describe('sanitize helpers', () => {
  it('normalizes valid urls and blocks non-http protocols', () => {
    expect(sanitizeOptionalUrl('example.com')).toBe('https://example.com/');
    expect(sanitizeOptionalUrl('https://valid.com/jobs')).toBe('https://valid.com/jobs');
    expect(sanitizeOptionalUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('trims and truncates text', () => {
    expect(sanitizeText('  hello  ', 10)).toBe('hello');
    expect(sanitizeText('abcdef', 3)).toBe('abc');
    expect(sanitizeText('   ', 10)).toBeUndefined();
  });

  it('deduplicates and limits tags', () => {
    expect(sanitizeTags(['A', 'A', 'B'])).toEqual(['A', 'B']);
    expect(sanitizeTags([])).toBeUndefined();
  });
});
