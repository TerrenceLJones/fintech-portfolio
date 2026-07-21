import { describe, expect, it } from 'vitest';
import {
  RECEIPT_REQUIRED_THRESHOLD_MINOR_UNITS,
  isValidExpenseAmount,
  requiresMemo,
  requiresReceipt,
  validateExpense,
  type ExpenseValidationInput,
} from './expense-policy';

function input(overrides: Partial<ExpenseValidationInput> = {}): ExpenseValidationInput {
  return {
    amountMinorUnits: 30_000,
    categoryId: 'travel',
    hasReceipt: true,
    ...overrides,
  };
}

describe('isValidExpenseAmount', () => {
  it('accepts a positive integer number of minor units', () => {
    expect(isValidExpenseAmount(1)).toBe(true);
    expect(isValidExpenseAmount(30_000)).toBe(true);
  });

  it('rejects zero, negative, fractional, NaN, and Infinity amounts', () => {
    expect(isValidExpenseAmount(0)).toBe(false);
    expect(isValidExpenseAmount(-100)).toBe(false);
    expect(isValidExpenseAmount(100.5)).toBe(false);
    expect(isValidExpenseAmount(Number.NaN)).toBe(false);
    expect(isValidExpenseAmount(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('requiresReceipt', () => {
  it('requires a receipt strictly over the $75.00 threshold', () => {
    expect(requiresReceipt(7_501)).toBe(true);
    expect(requiresReceipt(12_000)).toBe(true);
  });

  it('does not require a receipt at or below the threshold (boundary at exactly $75.00)', () => {
    expect(requiresReceipt(RECEIPT_REQUIRED_THRESHOLD_MINOR_UNITS)).toBe(false);
    expect(requiresReceipt(7_499)).toBe(false);
    expect(requiresReceipt(1)).toBe(false);
  });

  it('honours a configured threshold rather than the default (US-CW-037 AC-06)', () => {
    expect(requiresReceipt(6_000, 5_000)).toBe(true);
    expect(requiresReceipt(6_000, 10_000)).toBe(false);
  });
});

describe('requiresMemo', () => {
  it('requires a memo strictly over a configured threshold', () => {
    expect(requiresMemo(20_001, 20_000)).toBe(true);
    expect(requiresMemo(20_000, 20_000)).toBe(false);
  });

  it('never requires a memo when the threshold is 0 (not configured)', () => {
    expect(requiresMemo(1_000_000, 0)).toBe(false);
  });
});

describe('validateExpense', () => {
  it('allows a valid expense with a category and (when required) a receipt', () => {
    expect(validateExpense(input({ amountMinorUnits: 30_000 }))).toEqual({ ok: true });
  });

  it('allows an expense at or under $75.00 with no receipt', () => {
    expect(validateExpense(input({ amountMinorUnits: 7_500, hasReceipt: false }))).toEqual({
      ok: true,
    });
  });

  it('blocks a malformed amount before any other check', () => {
    expect(
      validateExpense(input({ amountMinorUnits: 0, categoryId: null, hasReceipt: false })),
    ).toEqual({ ok: false, reason: 'invalid_amount' });
  });

  it('blocks when no category is selected', () => {
    expect(validateExpense(input({ categoryId: null }))).toEqual({
      ok: false,
      reason: 'category_required',
    });
  });

  it('blocks an expense over $75.00 with no receipt attached (AC-02)', () => {
    expect(validateExpense(input({ amountMinorUnits: 12_000, hasReceipt: false }))).toEqual({
      ok: false,
      reason: 'receipt_required',
    });
  });

  it('blocks an expense over the memo threshold with no memo (US-CW-037 AC-06)', () => {
    expect(
      validateExpense(
        input({
          amountMinorUnits: 25_000,
          memoRequiredThresholdMinorUnits: 20_000,
          hasMemo: false,
        }),
      ),
    ).toEqual({ ok: false, reason: 'memo_required' });
  });

  it('allows an over-memo-threshold expense once a memo is provided', () => {
    expect(
      validateExpense(
        input({ amountMinorUnits: 25_000, memoRequiredThresholdMinorUnits: 20_000, hasMemo: true }),
      ),
    ).toEqual({ ok: true });
  });
});
