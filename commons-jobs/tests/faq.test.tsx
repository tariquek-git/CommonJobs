// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FAQ from '../components/FAQ';

describe('FAQ', () => {
  it('renders professional beta-safe guidance', () => {
    render(<FAQ onBack={() => {}} />);

    expect(screen.getByRole('heading', { name: /what is commons jobs/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /how long does moderation take/i })).toBeTruthy();
    expect(screen.getByText(/reviewed within 24 hours/i)).toBeTruthy();
  });
});
