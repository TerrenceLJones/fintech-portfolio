import { useMemo, useState } from 'react';
import type { DateRange } from '@clearline/contracts';
import { validateDateRange, type DateRangeValidation } from '@clearline/data-access-analytics';

/** The dashboard opens on June 2026 — the seeded demo month — and "Reset" returns here (AC-03). */
export const DEFAULT_DASHBOARD_RANGE: DateRange = { from: '2026-06-01', to: '2026-06-30' };

export interface DashboardFilter {
  /** The range actually being queried — only ever a validated range (AC-04). */
  committedRange: DateRange;
  /** The in-progress edit, which may be invalid. */
  draft: DateRange;
  validation: DateRangeValidation;
  /** True once the draft differs from what's committed — gates the Apply button. */
  isDirty: boolean;
  setDraft: (draft: DateRange) => void;
  /** Commit the draft as the queried range — a no-op while the draft is invalid, so an invalid range never refetches (AC-04). */
  apply: () => void;
  /** Return both draft and committed range to the default month (the empty state's "Reset", AC-03). */
  reset: () => void;
}

/**
 * Owns the dashboard's date-range state and the AC-04 guarantee: a range is validated (start/end
 * ordering) on the client BEFORE it becomes the committed, queried range. Editing the draft never
 * moves the data; only a valid `apply()` does — so an end-before-start range surfaces its inline error
 * and the dashboard keeps showing the last good range until corrected.
 */
export function useDashboardFilter(initial: DateRange = DEFAULT_DASHBOARD_RANGE): DashboardFilter {
  const [committedRange, setCommittedRange] = useState<DateRange>(initial);
  const [draft, setDraft] = useState<DateRange>(initial);

  const validation = useMemo(() => validateDateRange(draft), [draft]);
  const isDirty = draft.from !== committedRange.from || draft.to !== committedRange.to;

  function apply() {
    if (!validation.valid) return;
    setCommittedRange(draft);
  }

  function reset() {
    setDraft(initial);
    setCommittedRange(initial);
  }

  return { committedRange, draft, validation, isDirty, setDraft, apply, reset };
}
