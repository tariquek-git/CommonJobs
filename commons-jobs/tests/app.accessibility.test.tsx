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
  hasAdminSession: vi.fn().mockReturnValue(false)
}));

vi.mock('../services/geminiService', () => ({
  parseSearchQuery: vi.fn().mockResolvedValue(null)
}));

describe('App accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getJobs).mockResolvedValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renders a skip link, labeled search input, and expanded state on filters button', async () => {
    render(<App />);

    await waitFor(() => {
      expect(vi.mocked(getJobs)).toHaveBeenCalled();
    });

    expect(screen.getByText('Skip to main content')).toBeTruthy();
    expect(screen.getByLabelText('Search jobs')).toBeTruthy();

    const filtersButton = screen.getByRole('button', { name: /filters/i });
    expect(filtersButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows an alert with retry action when jobs fail to load', async () => {
    vi.mocked(getJobs).mockRejectedValueOnce(new Error('network fail'));
    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Unable to load roles right now');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
