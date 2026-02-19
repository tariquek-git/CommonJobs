import { describe, expect, it } from 'vitest';
import {
  getInitialState,
  mapSubmissionError,
  normalizeAIData,
  sanitizePayloadForSubmit,
  validateRequiredFields
} from '../utils/submitJobFormUtils';

describe('submitJobFormUtils', () => {
  it('creates default state for direct source', () => {
    const state = getInitialState('Direct');
    expect(state.status).toBe('pending');
    expect(state.sourceType).toBe('Direct');
    expect(state.isVerified).toBe(true);
  });

  it('normalizes AI data and prevents dangerous field overwrite', () => {
    const normalized = normalizeAIData({
      roleTitle: 'Senior Engineer',
      locationCountry: 'US',
      remotePolicy: 'fully remote',
      externalLink: 'https://malicious.example.com',
      tags: ['Payments', 'Risk']
    });

    expect(normalized.roleTitle).toBe('Senior Engineer');
    expect(normalized.locationCountry).toBe('United States');
    expect(normalized.remotePolicy).toBe('Remote');
    expect((normalized as Record<string, unknown>).externalLink).toBeUndefined();
    expect(normalized.tags).toEqual(['Payments', 'Risk']);
  });

  it('sanitizes payload by trimming fields and dropping invalid enums', () => {
    const sanitized = sanitizePayloadForSubmit({
      roleTitle: '  Engineer  ',
      remotePolicy: 'Invalid' as never,
      tags: []
    });

    expect(sanitized.roleTitle).toBe('Engineer');
    expect(sanitized.remotePolicy).toBeUndefined();
    expect(sanitized.tags).toBeUndefined();
  });

  it('validates required fields for non-admin submission', () => {
    const errors = validateRequiredFields({
      formData: {},
      isAdminMode: false,
      trimmedSubmitterName: '',
      trimmedSubmitterEmail: '',
      trimmedExternalLink: ''
    });

    expect(errors.externalLink).toBeTruthy();
    expect(errors.roleTitle).toBeTruthy();
    expect(errors.companyName).toBeTruthy();
    expect(errors.submitterName).toBeTruthy();
    expect(errors.submitterEmail).toBeTruthy();
  });

  it('maps rate-limited error to friendly text', () => {
    const mapped = mapSubmissionError('Rate limited');
    expect(mapped.message).toContain('Too many attempts');
  });
});
