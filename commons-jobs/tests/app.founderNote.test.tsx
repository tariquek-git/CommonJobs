// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const FOUNDER_NOTE_COLLAPSED_KEY = 'commons_jobs_founder_note_collapsed_v1';

describe('App founder note section', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
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

  it('starts expanded, then persists collapsed state after close', async () => {
    const { unmount } = render(<App />);

    await waitFor(() => {
      expect(vi.mocked(getJobs)).toHaveBeenCalled();
    });

    const toggle = screen.getByRole('button', { name: /why i built commons jobs/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/Hi, it's Tarique/i)).toBeTruthy();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/Hi, it's Tarique/i)).toBeNull();
    expect(localStorage.getItem(FOUNDER_NOTE_COLLAPSED_KEY)).toBe('1');

    unmount();
    render(<App />);

    await waitFor(() => {
      expect(vi.mocked(getJobs)).toHaveBeenCalled();
    });

    const secondToggle = screen.getByRole('button', { name: /why i built commons jobs/i });
    expect(secondToggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/Hi, it's Tarique/i)).toBeNull();
  });

  it('keeps both permanent boxes and note visible while collapsed', async () => {
    localStorage.setItem(FOUNDER_NOTE_COLLAPSED_KEY, '1');
    render(<App />);

    await waitFor(() => {
      expect(vi.mocked(getJobs)).toHaveBeenCalled();
    });

    expect(screen.getAllByText('Community Board').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Web Pulse').length).toBeGreaterThan(0);
    expect(screen.getByText(/Please note:/i)).toBeTruthy();
  });
});
