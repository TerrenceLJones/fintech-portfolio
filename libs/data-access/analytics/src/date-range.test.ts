import { describe, expect, it } from 'vitest';
import { END_BEFORE_START_ERROR, validateDateRange } from './date-range';

describe('validateDateRange', () => {
  it('accepts a normal start-before-end range', () => {
    expect(validateDateRange({ from: '2026-06-01', to: '2026-06-30' })).toEqual({ valid: true });
  });

  it('accepts a single-day range (end equal to start)', () => {
    expect(validateDateRange({ from: '2026-06-15', to: '2026-06-15' })).toEqual({ valid: true });
  });

  it('rejects an end date earlier than the start with the inline error copy (AC-04)', () => {
    expect(validateDateRange({ from: '2026-06-30', to: '2026-06-12' })).toEqual({
      valid: false,
      error: END_BEFORE_START_ERROR,
    });
  });

  it('is invalid with no message when a bound is missing', () => {
    expect(validateDateRange({ from: '2026-06-01', to: '' })).toEqual({ valid: false });
    expect(validateDateRange({ from: '', to: '2026-06-30' })).toEqual({ valid: false });
  });
});
