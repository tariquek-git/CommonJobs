// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import JobDetailModal from '../components/JobDetailModal';
import { JobPosting } from '../types';

vi.mock('../services/jobService', () => ({
  trackClick: vi.fn()
}));

const baseJob: JobPosting = {
  id: 'job-1',
  companyName: 'Acme',
  companyWebsite: 'https://example.com',
  roleTitle: 'Senior Engineer',
  externalLink: 'https://example.com/jobs/1',
  postedDate: new Date().toISOString(),
  status: 'active',
  sourceType: 'Direct',
  isVerified: true,
  clicks: 0
};

describe('JobDetailModal accessibility', () => {
  it('renders with dialog semantics and labeled close button', () => {
    render(<JobDetailModal job={baseJob} onClose={() => {}} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('button', { name: 'Close job details' })).toBeTruthy();
  });

  it('closes on Escape key press', () => {
    const onClose = vi.fn();
    render(<JobDetailModal job={baseJob} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
