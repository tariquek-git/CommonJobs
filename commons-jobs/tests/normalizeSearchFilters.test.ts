import { describe, expect, it } from 'vitest';
import { normalizeParsedSearchFilters } from '../utils/normalizeSearchFilters';
import { EmploymentType, RemotePolicy, SeniorityLevel } from '../types';

describe('normalizeParsedSearchFilters', () => {
  it('normalizes case and common aliases', () => {
    const normalized = normalizeParsedSearchFilters({
      keyword: 'backend payments',
      remotePolicies: ['remote', 'Hybrid'],
      employmentTypes: ['full time', 'contractor'],
      seniorityLevels: ['Sr', 'mid level'],
      dateRange: 'week'
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.keyword).toBe('backend payments');
    expect(normalized?.remotePolicies).toEqual([RemotePolicy.REMOTE, RemotePolicy.HYBRID]);
    expect(normalized?.employmentTypes).toEqual([EmploymentType.FULL_TIME, EmploymentType.CONTRACT]);
    expect(normalized?.seniorityLevels).toEqual([SeniorityLevel.SENIOR, SeniorityLevel.MID]);
    expect(normalized?.dateRange).toBe('7d');
  });

  it('drops unknown values safely', () => {
    const normalized = normalizeParsedSearchFilters({
      keyword: 'test',
      remotePolicies: ['spaceship'],
      employmentTypes: ['unicorn'],
      seniorityLevels: ['guru'],
      dateRange: 'yesterday'
    });

    expect(normalized?.remotePolicies).toEqual([]);
    expect(normalized?.employmentTypes).toEqual([]);
    expect(normalized?.seniorityLevels).toEqual([]);
    expect(normalized?.dateRange).toBe('all');
  });
});

