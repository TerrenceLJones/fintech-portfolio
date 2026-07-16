import { describe, expect, it } from 'vitest';
import {
  STALE_THRESHOLD_MINUTES,
  ageInMinutes,
  formatRelativeAge,
  isStale,
} from './format-relative-time';

const NOW = Date.UTC(2026, 6, 16, 12, 0, 0);
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

describe('ageInMinutes', () => {
  it('floors to whole minutes and never goes negative', () => {
    expect(ageInMinutes(minutesAgo(10), NOW)).toBe(10);
    expect(ageInMinutes(new Date(NOW + 60_000).toISOString(), NOW)).toBe(0);
  });
});

describe('formatRelativeAge', () => {
  it('renders "just now" under a minute', () => {
    expect(formatRelativeAge(minutesAgo(0), NOW)).toBe('just now');
  });

  it('singularises one minute and pluralises others (AC-06)', () => {
    expect(formatRelativeAge(minutesAgo(1), NOW)).toBe('1 minute ago');
    expect(formatRelativeAge(minutesAgo(10), NOW)).toBe('10 minutes ago');
  });

  it('rolls up to hours and days', () => {
    expect(formatRelativeAge(minutesAgo(60), NOW)).toBe('1 hour ago');
    expect(formatRelativeAge(minutesAgo(150), NOW)).toBe('2 hours ago');
    expect(formatRelativeAge(minutesAgo(60 * 25), NOW)).toBe('1 day ago');
  });
});

describe('isStale', () => {
  it('is false while fresh and true past the threshold (AC-06)', () => {
    expect(isStale(minutesAgo(STALE_THRESHOLD_MINUTES - 1), NOW)).toBe(false);
    expect(isStale(minutesAgo(10), NOW)).toBe(true);
  });
});
