// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const analyzeJobDescriptionMock = vi.fn().mockResolvedValue(null);
vi.mock('../services/geminiService', () => ({
  analyzeJobDescription: (...args: unknown[]) => analyzeJobDescriptionMock(...args)
}));

const submitJobMock = vi.fn();

vi.mock('../services/jobService', () => ({
  submitJob: (...args: unknown[]) => submitJobMock(...args),
  updateJob: vi.fn().mockResolvedValue(undefined),
  createAdminJob: vi.fn().mockResolvedValue({ id: 'admin-job' })
}));

describe('SubmitJobForm', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    cleanup();
    submitJobMock.mockReset();
    analyzeJobDescriptionMock.mockReset();
    analyzeJobDescriptionMock.mockResolvedValue(null);
  });

  it('shows a success confirmation with a reference id after submission', async () => {
    submitJobMock.mockResolvedValueOnce('job-123');
    const onSuccess = vi.fn();

    const SubmitJobForm = (await import('../components/SubmitJobForm')).default;
    render(<SubmitJobForm onSuccess={onSuccess} onOpenTerms={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/link to apply/i), { target: { value: 'https://example.com/apply' } });
    fireEvent.change(screen.getByLabelText(/role title/i), { target: { value: 'Backend Engineer' } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Test Co' } });
    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: 'Canada' } });
    fireEvent.change(screen.getByLabelText(/^city/i), { target: { value: 'Toronto' } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/your email/i), { target: { value: 'alice@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: /submit for verification/i }));

    await waitFor(() => {
      expect(screen.getByText('Submission Received')).toBeTruthy();
    });
    expect(screen.getByText('job-123')).toBeTruthy();
    expect(screen.getByText(/what happens next/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /submit another role/i })).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /back to browse/i }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows an admin dashboard shortcut when provided', async () => {
    submitJobMock.mockResolvedValueOnce('job-999');
    const onSuccess = vi.fn();
    const onOpenAdminDashboard = vi.fn();

    const SubmitJobForm = (await import('../components/SubmitJobForm')).default;
    render(
      <SubmitJobForm onSuccess={onSuccess} onOpenTerms={vi.fn()} onOpenAdminDashboard={onOpenAdminDashboard} />
    );

    fireEvent.change(screen.getByLabelText(/link to apply/i), { target: { value: 'https://example.com/apply' } });
    fireEvent.change(screen.getByLabelText(/role title/i), { target: { value: 'Backend Engineer' } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Test Co' } });
    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: 'Canada' } });
    fireEvent.change(screen.getByLabelText(/^city/i), { target: { value: 'Toronto' } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/your email/i), { target: { value: 'alice@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: /submit for verification/i }));

    await waitFor(() => {
      expect(screen.getByText('Submission Received')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /open admin dashboard/i }));
    expect(onOpenAdminDashboard).toHaveBeenCalledTimes(1);
  });

  it('renders API error messages', async () => {
    submitJobMock.mockRejectedValueOnce(new Error('Rate limited'));
    const SubmitJobForm = (await import('../components/SubmitJobForm')).default;
    render(<SubmitJobForm onSuccess={vi.fn()} onOpenTerms={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/link to apply/i), { target: { value: 'https://example.com/apply' } });
    fireEvent.change(screen.getByLabelText(/role title/i), { target: { value: 'Backend Engineer' } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Test Co' } });
    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: 'Canada' } });
    fireEvent.change(screen.getByLabelText(/^city/i), { target: { value: 'Toronto' } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/your email/i), { target: { value: 'alice@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: /submit for verification/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Rate limited');
  });

  it('trims submitter fields before sending to the API', async () => {
    submitJobMock.mockResolvedValueOnce('job-123');
    const SubmitJobForm = (await import('../components/SubmitJobForm')).default;
    render(<SubmitJobForm onSuccess={vi.fn()} onOpenTerms={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/link to apply/i), { target: { value: '  https://example.com/apply  ' } });
    fireEvent.change(screen.getByLabelText(/role title/i), { target: { value: 'Backend Engineer' } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Test Co' } });
    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: 'Canada' } });
    fireEvent.change(screen.getByLabelText(/^city/i), { target: { value: 'Toronto' } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: '  Alice  ' } });
    fireEvent.change(screen.getByLabelText(/your email/i), { target: { value: '  alice@example.com  ' } });

    fireEvent.click(screen.getByRole('button', { name: /submit for verification/i }));

    await waitFor(() => expect(submitJobMock).toHaveBeenCalledTimes(1));
    const firstArg = submitJobMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstArg.externalLink).toBe('https://example.com/apply');
    expect(firstArg.submitterName).toBe('Alice');
    expect(firstArg.submitterEmail).toBe('alice@example.com');
  });

  it('keeps a valid default Remote Policy when AI returns an empty/invalid remotePolicy', async () => {
    analyzeJobDescriptionMock.mockResolvedValueOnce({
      summary: 'Test summary',
      remotePolicy: '',
      companyName: null
    });

    const SubmitJobForm = (await import('../components/SubmitJobForm')).default;
    render(<SubmitJobForm onSuccess={vi.fn()} onOpenTerms={vi.fn()} />);

    // Provide JD text so the AI button is enabled.
    fireEvent.change(
      screen.getByLabelText(/paste job description/i),
      { target: { value: 'Some job description text' } }
    );

    fireEvent.click(screen.getByRole('button', { name: /generate summary & tags/i }));

    await waitFor(() => {
      const select = screen.getByLabelText(/remote policy/i) as HTMLSelectElement;
      expect(select.value).toBe('Onsite');
    });

    const company = screen.getByLabelText(/company name/i) as HTMLInputElement;
    expect(company.value).toBe('');
  });
});
