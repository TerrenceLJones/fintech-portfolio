import type { DateRange } from '@clearline/contracts';

/** The inline message shown when a custom range's end precedes its start (US-CW-015 AC-04). */
export const END_BEFORE_START_ERROR = 'End date must be after the start date.';

export interface DateRangeValidation {
  valid: boolean;
  /** Present only on the ordering failure — the exact copy the filter renders inline. */
  error?: string;
}

/**
 * Client-side validation run BEFORE a range ever becomes a query (US-CW-015 AC-04): an end date
 * earlier than the start is rejected with an inline error and the filter is not applied. A
 * single-day range (end === start) is valid. Missing dates are invalid but carry no message — the
 * Apply action simply stays disabled until both are set. ISO YYYY-MM-DD strings compare correctly
 * lexicographically, so no Date parsing is needed.
 */
export function validateDateRange(range: DateRange): DateRangeValidation {
  if (!range.from || !range.to) return { valid: false };
  if (range.to < range.from) return { valid: false, error: END_BEFORE_START_ERROR };
  return { valid: true };
}
