import { describe, expect, it } from 'vitest';
import { stripApiPrefix } from '../src/runtime.js';

describe('stripApiPrefix', () => {
  it('strips the /api prefix for API paths', () => {
    expect(stripApiPrefix('/api/jobs/search')).toBe('/jobs/search');
    expect(stripApiPrefix('/api/health')).toBe('/health');
  });

  it('normalizes bare /api to root', () => {
    expect(stripApiPrefix('/api')).toBe('/');
    expect(stripApiPrefix('/api/')).toBe('/');
  });

  it('preserves query strings when stripping prefix', () => {
    expect(stripApiPrefix('/api/jobs/search?feedType=direct')).toBe('/jobs/search?feedType=direct');
  });

  it('leaves non-api paths unchanged', () => {
    expect(stripApiPrefix('/jobs/search')).toBe('/jobs/search');
    expect(stripApiPrefix('/apix/test')).toBe('/apix/test');
  });
});
