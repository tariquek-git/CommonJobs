// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { getJobs } from '../services/jobService';

vi.mock('../services/jobService', () => ({
  getJobs: vi.fn(),
  getJobById: vi.fn().mockResolvedValue(undefined),
  adminLogin: vi.fn().mockResolvedValue(false),
  adminLogout: vi.fn(),
  refreshAdminSession: vi.fn().mockResolvedValue(false)
}));

vi.mock('../services/geminiService', () => ({
  parseSearchQuery: vi.fn().mockResolvedValue(null)
}));

describe('App browse header controls', () => {
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

  it('hides the search bar and still renders sort and feedback controls', async () => {
    render(<App />);

    await waitFor(() => {
      expect(vi.mocked(getJobs)).toHaveBeenCalled();
    });

    expect(screen.queryByLabelText('Search jobs')).toBeNull();
    expect(screen.getByLabelText('Sort')).toBeTruthy();
    expect(screen.getByRole('link', { name: /send feedback/i })).toBeTruthy();
  });
});
