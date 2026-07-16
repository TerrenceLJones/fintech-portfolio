import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_DASHBOARD_RANGE, useDashboardFilter } from './useDashboardFilter';

describe('useDashboardFilter', () => {
  it('starts committed to the default June 2026 range with a matching draft', () => {
    const { result } = renderHook(() => useDashboardFilter());
    expect(result.current.committedRange).toEqual(DEFAULT_DASHBOARD_RANGE);
    expect(result.current.draft).toEqual(DEFAULT_DASHBOARD_RANGE);
    expect(result.current.isDirty).toBe(false);
  });

  it('commits a valid draft on apply()', () => {
    const { result } = renderHook(() => useDashboardFilter());
    const next = { from: '2026-05-01', to: '2026-05-31' };
    act(() => result.current.setDraft(next));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.apply());
    expect(result.current.committedRange).toEqual(next);
  });

  it('does NOT commit an end-before-start draft — the range never refetches (AC-04)', () => {
    const { result } = renderHook(() => useDashboardFilter());
    act(() => result.current.setDraft({ from: '2026-06-30', to: '2026-06-12' }));
    expect(result.current.validation.valid).toBe(false);
    act(() => result.current.apply());
    // Committed range is unchanged — the invalid draft was rejected.
    expect(result.current.committedRange).toEqual(DEFAULT_DASHBOARD_RANGE);
  });

  it('reset() returns both draft and committed range to the default (AC-03)', () => {
    const { result } = renderHook(() => useDashboardFilter());
    act(() => result.current.setDraft({ from: '2026-07-01', to: '2026-07-07' }));
    act(() => result.current.apply());
    act(() => result.current.reset());
    expect(result.current.committedRange).toEqual(DEFAULT_DASHBOARD_RANGE);
    expect(result.current.draft).toEqual(DEFAULT_DASHBOARD_RANGE);
  });
});
