import { describe, expect, it } from 'vitest';
import { relativeTime } from './relative-time';

const NOW = new Date('2026-07-15T12:00:00.000Z').getTime();

describe('relativeTime', () => {
  it('reads "just now" for a sub-minute-old timestamp', () => {
    expect(relativeTime('2026-07-15T11:59:40.000Z', NOW)).toBe('just now');
  });

  it('reads minutes and hours for recent timestamps', () => {
    expect(relativeTime('2026-07-15T11:40:00.000Z', NOW)).toBe('20m ago');
    expect(relativeTime('2026-07-15T10:00:00.000Z', NOW)).toBe('2h ago');
  });

  it('reads "Yesterday" for a day-old timestamp', () => {
    expect(relativeTime('2026-07-14T11:00:00.000Z', NOW)).toBe('Yesterday');
  });

  it('falls back to a short date for older timestamps', () => {
    expect(relativeTime('2026-06-26T14:20:00.000Z', NOW)).toBe('Jun 26');
  });
});
