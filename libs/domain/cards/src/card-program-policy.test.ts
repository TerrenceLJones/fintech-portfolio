import { describe, expect, it } from 'vitest';
import type { MerchantCategoryOption } from '@clearline/contracts';
import {
  canRequestCard,
  searchMerchantCategories,
  validateCardProgramLimits,
} from './card-program-policy';

const CATALOGUE: MerchantCategoryOption[] = [
  { code: 'software', mcc: '5734', label: 'Software & Cloud Services' },
  { code: 'office_supplies', mcc: '5943', label: 'Office Supplies' },
  { code: 'travel', mcc: '4722', label: 'Travel' },
];

describe('canRequestCard (AC-03)', () => {
  it('lets anyone request a card when the policy is "everyone"', () => {
    expect(canRequestCard('employee', 'everyone')).toBe(true);
    expect(canRequestCard('finance_manager', 'everyone')).toBe(true);
    expect(canRequestCard('controller', 'everyone')).toBe(true);
  });

  it('blocks an Employee but allows managers and above when policy is "managers_and_above"', () => {
    expect(canRequestCard('employee', 'managers_and_above')).toBe(false);
    expect(canRequestCard('finance_manager', 'managers_and_above')).toBe(true);
    expect(canRequestCard('controller', 'managers_and_above')).toBe(true);
  });
});

describe('searchMerchantCategories (AC-02)', () => {
  it('returns the whole catalogue for an empty or whitespace query', () => {
    expect(searchMerchantCategories(CATALOGUE, '')).toHaveLength(3);
    expect(searchMerchantCategories(CATALOGUE, '   ')).toHaveLength(3);
  });

  it('matches by category name, case-insensitively', () => {
    const result = searchMerchantCategories(CATALOGUE, 'office');
    expect(result.map((c) => c.code)).toEqual(['office_supplies']);
  });

  it('matches by numeric MCC code', () => {
    const result = searchMerchantCategories(CATALOGUE, '5734');
    expect(result.map((c) => c.code)).toEqual(['software']);
  });

  it('matches a partial numeric code', () => {
    // Both 5734 and 5943 start with "5"; a "59" prefix narrows to office supplies.
    expect(searchMerchantCategories(CATALOGUE, '59').map((c) => c.code)).toEqual([
      'office_supplies',
    ]);
  });

  it('returns nothing for a query that matches no name or code', () => {
    expect(searchMerchantCategories(CATALOGUE, 'zzz')).toEqual([]);
  });
});

describe('validateCardProgramLimits (AC-01)', () => {
  it('accepts positive integer limits where per-transaction does not exceed monthly', () => {
    expect(
      validateCardProgramLimits({
        defaultMonthlyLimitMinorUnits: 200_000,
        defaultPerTransactionLimitMinorUnits: 50_000,
      }).ok,
    ).toBe(true);
  });

  it('rejects a non-positive or non-integer limit', () => {
    expect(
      validateCardProgramLimits({
        defaultMonthlyLimitMinorUnits: 0,
        defaultPerTransactionLimitMinorUnits: 50_000,
      }).ok,
    ).toBe(false);
    expect(
      validateCardProgramLimits({
        defaultMonthlyLimitMinorUnits: 200_000,
        defaultPerTransactionLimitMinorUnits: 1.5,
      }).ok,
    ).toBe(false);
  });

  it('rejects a per-transaction limit that exceeds the monthly limit', () => {
    expect(
      validateCardProgramLimits({
        defaultMonthlyLimitMinorUnits: 50_000,
        defaultPerTransactionLimitMinorUnits: 200_000,
      }).ok,
    ).toBe(false);
  });
});
