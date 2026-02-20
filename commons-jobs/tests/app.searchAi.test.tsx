// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { getJobs } from '../services/jobService';
import { parseSearchQuery } from '../services/geminiService';

vi.mock('../services/jobService', () => ({
  getJobs: vi.fn(),
  getJobById: vi.fn().mockResolvedValue(undefined),
  adminLogin: vi.fn().mockResolvedValue(false),
  adminLogout: vi.fn(),
  hasAdminSession: vi.fn().mockReturnValue(false)
}));

vi.mock('../services/geminiService', () => ({
  parseSearchQuery: vi.fn().mockResolvedValue(null)
}));

describe('App AI search sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getJobs).mockResolvedValue({
      jobs: [],
      total: 0,
      page: 1,
      pageSize: 30,
      facets: {
        remotePolicies: { Onsite: 0, Hybrid: 0, Remote: 0 },
        employmentTypes: { 'Full-time': 0, Contract: 0, Internship: 0 },
        seniorityLevels: { Junior: 0, 'Mid-Level': 0, Senior: 0, Lead: 0, Executive: 0 }
      }
    });
  });

  it('keeps input text synchronized with parsed AI keyword', async () => {
    vi.mocked(parseSearchQuery).mockResolvedValueOnce({
      fallback: false,
      result: {
        keyword: 'risk engineer',
        remotePolicies: ['Remote'],
        employmentTypes: ['Full-time'],
        seniorityLevels: ['Senior'],
        dateRange: '7d'
      }
    });

    render(<App />);

    const input = screen.getByLabelText('Search jobs') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'remote fintech roles' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(input.value).toBe('risk engineer');
    });

    await waitFor(() => {
      expect(vi.mocked(getJobs).mock.calls.some((call) => call[0]?.keyword === 'risk engineer')).toBe(true);
    });
  });
});
