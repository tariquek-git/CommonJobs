// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FAQ from '../components/FAQ';

describe('FAQ', () => {
  it('renders the custom FAQ message', () => {
    render(<FAQ onBack={() => {}} />);

    expect(screen.getByText(/no faq needed/i)).toBeTruthy();
  });
});
