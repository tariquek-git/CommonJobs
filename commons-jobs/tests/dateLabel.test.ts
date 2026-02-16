import { describe, expect, it } from 'vitest';
import { getPostedAgeDays, getPostedDateLabel } from '../utils/dateLabel';

describe('date labels', () => {
  const now = new Date('2026-02-16T12:00:00.000Z');

  it('labels jobs posted within 24 hours as Today', () => {
    const posted = '2026-02-16T10:00:00.000Z';
    expect(getPostedDateLabel(posted, now)).toBe('Today');
    expect(getPostedAgeDays(posted, now)).toBe(0);
  });

  it('labels jobs posted between 24 and 48 hours as Yesterday', () => {
    const posted = '2026-02-15T10:00:00.000Z';
    expect(getPostedDateLabel(posted, now)).toBe('Yesterday');
    expect(getPostedAgeDays(posted, now)).toBe(1);
  });

  it('labels jobs older than 48 hours in days ago format', () => {
    const posted = '2026-02-14T11:00:00.000Z';
    expect(getPostedDateLabel(posted, now)).toBe('2 days ago');
    expect(getPostedAgeDays(posted, now)).toBe(2);
  });
});
