import type { Money } from '@clearline/contracts';

/**
 * Thrown when the server rejects a split because the portions don't sum exactly to the source amount
 * (US-CW-016 AC-05). Carries the expected vs provided totals the server echoed back, so the page can
 * explain the shortfall precisely — the client also validates before submitting, so this is the
 * defense-in-depth server verdict, not the primary feedback path.
 */
export class SplitMismatchError extends Error {
  readonly expected: Money;
  readonly provided: Money;

  constructor(expected: Money, provided: Money) {
    super('split_mismatch');
    this.name = 'SplitMismatchError';
    this.expected = expected;
    this.provided = provided;
  }
}
