// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDashboard from '../components/AdminDashboard';

const updateJobStatusMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../services/jobService', () => ({
  getAdminJobs: vi.fn().mockResolvedValue([
    {
      id: 'agg-1',
      companyName: 'RepeatCo',
      companyWebsite: 'https://repeat.example.com',
      roleTitle: 'Role One',
      externalLink: 'https://repeat.example.com/jobs/1',
      postedDate: new Date().toISOString(),
      status: 'active',
      sourceType: 'Aggregated',
      isVerified: false,
      externalSource: 'Feed',
      clicks: 0
    },
    {
      id: 'agg-2',
      companyName: 'RepeatCo',
      companyWebsite: 'https://repeat.example.com',
      roleTitle: 'Role Two',
      externalLink: 'https://repeat.example.com/jobs/2',
      postedDate: new Date().toISOString(),
      status: 'active',
      sourceType: 'Aggregated',
      isVerified: false,
      externalSource: 'Feed',
      clicks: 0
    },
    {
      id: 'agg-3',
      companyName: 'RepeatCo',
      companyWebsite: 'https://repeat.example.com',
      roleTitle: 'Role Three',
      externalLink: 'https://repeat.example.com/jobs/3',
      postedDate: new Date().toISOString(),
      status: 'active',
      sourceType: 'Aggregated',
      isVerified: false,
      externalSource: 'Feed',
      clicks: 0
    },
    {
      id: 'agg-4',
      companyName: 'RepeatCo',
      companyWebsite: 'https://repeat.example.com',
      roleTitle: 'Role Four',
      externalLink: 'https://repeat.example.com/jobs/4',
      postedDate: new Date().toISOString(),
      status: 'active',
      sourceType: 'Aggregated',
      isVerified: false,
      externalSource: 'Feed',
      clicks: 0
    },
    {
      id: 'agg-5',
      companyName: 'RepeatCo',
      companyWebsite: 'https://repeat.example.com',
      roleTitle: 'Role Five',
      externalLink: 'https://repeat.example.com/jobs/5',
      postedDate: new Date().toISOString(),
      status: 'active',
      sourceType: 'Aggregated',
      isVerified: false,
      externalSource: 'Feed',
      clicks: 0
    },
    {
      id: 'agg-6',
      companyName: 'RepeatCo',
      companyWebsite: 'https://repeat.example.com',
      roleTitle: 'Role Six',
      externalLink: 'https://repeat.example.com/jobs/6',
      postedDate: new Date().toISOString(),
      status: 'active',
      sourceType: 'Aggregated',
      isVerified: false,
      externalSource: 'Feed',
      clicks: 0
    }
  ]),
  getAdminRuntime: vi.fn().mockResolvedValue({
    ok: true,
    provider: 'supabase',
    tables: { jobs: 'job_board_jobs', clicks: 'job_board_clicks' },
    gemini: { enabled: true, model: 'gemini-flash-latest' },
    env: { nodeEnv: 'production', trustProxy: 1 },
    storageProbe: { ok: true, totalJobs: 6, error: null },
    vercel: { gitCommitSha: null, deploymentId: null }
  }),
  updateJobStatus: (...args: unknown[]) => updateJobStatusMock(...args)
}));

describe('AdminDashboard', () => {
  beforeEach(() => {
    updateJobStatusMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows company cap warning when active aggregated jobs exceed max per company', async () => {
    render(<AdminDashboard />);

    expect(await screen.findByText(/aggregated company cap warning/i)).toBeTruthy();
    expect(screen.getByText(/repeatco: 6/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /download rebalance suggestion/i })).toBeTruthy();
  });

  it('supports bulk approve for selected rows', async () => {
    render(<AdminDashboard />);

    await screen.findByText('Role One');
    fireEvent.click(screen.getByLabelText('Select Role One'));

    const bulkApprove = await screen.findByRole('button', { name: /bulk approve/i });
    fireEvent.click(bulkApprove);

    await waitFor(() => {
      expect(updateJobStatusMock).toHaveBeenCalledWith('agg-1', 'active');
    });
  });
});
