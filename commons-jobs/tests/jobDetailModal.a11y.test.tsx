// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    cleanup();
  });

  it('renders with dialog semantics and labeled close button', () => {
    render(<JobDetailModal job={baseJob} onClose={() => {}} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('button', { name: 'Close job details' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /report an issue/i })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /request intro/i }).length).toBeGreaterThan(0);
  });

  it('focuses the close button on mount', () => {
    render(<JobDetailModal job={baseJob} onClose={() => {}} />);
    const close = screen.getByRole('button', { name: 'Close job details' });
    expect(document.activeElement).toBe(close);
  });

  it('closes on Escape key press', () => {
    const onClose = vi.fn();
    render(<JobDetailModal job={baseJob} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps keyboard focus within the dialog', () => {
    render(<JobDetailModal job={baseJob} onClose={() => {}} />);

    const closeButton = screen.getByRole('button', { name: 'Close job details' });
    const applyButton = screen.getByRole('button', { name: /apply on company site/i });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(applyButton);

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);
  });

  it('does not show intro CTA for aggregated roles', () => {
    render(
      <JobDetailModal
        job={{ ...baseJob, sourceType: 'Aggregated', externalSource: 'Bank Feed', isVerified: false }}
        onClose={() => {}}
      />
    );

    expect(screen.queryByRole('link', { name: /request intro/i })).toBeNull();
  });
});
