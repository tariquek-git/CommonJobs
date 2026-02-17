// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/AdminDashboard', () => ({
  default: () => <div>ADMIN_DASHBOARD</div>
}));

vi.mock('../services/jobService', () => ({
  getJobs: vi.fn().mockResolvedValue([]),
  getJobById: vi.fn().mockResolvedValue(undefined),
  adminLogin: vi.fn().mockResolvedValue(false),
  adminLogout: vi.fn(),
  hasAdminSession: vi.fn().mockReturnValue(true)
}));

vi.mock('../services/geminiService', () => ({
  parseSearchQuery: vi.fn().mockResolvedValue(null)
}));

describe('App admin navigation', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('shows Admin Dashboard + Logout when an admin session exists', async () => {
    const App = (await import('../App')).default;
    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText('Search jobs')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'Admin Dashboard' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /admin login/i })).toBeNull();
  });

  it('navigates to the admin dashboard when clicked', async () => {
    const App = (await import('../App')).default;
    render(<App />);

    const adminButton = (await screen.findAllByRole('button', { name: 'Admin Dashboard' }))[0];
    if (!adminButton) throw new Error('Admin Dashboard button not found');
    fireEvent.click(adminButton);

    expect(screen.getByText('ADMIN_DASHBOARD')).toBeTruthy();
  });
});
