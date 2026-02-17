// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/geminiService', () => ({
  analyzeJobDescription: vi.fn().mockResolvedValue(null)
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
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /back to browse/i }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
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
});
