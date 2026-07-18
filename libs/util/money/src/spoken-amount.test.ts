import { describe, expect, it } from 'vitest';
import { spokenMoney, spokenMoneyAmount } from './spoken-amount';

describe('spokenMoneyAmount', () => {
  it('speaks a whole-dollar amount without a cents clause (WCAG AC-03)', () => {
    // "$1,999.00" -> the exact example spelled out in US-CW-020 AC-03.
    expect(spokenMoneyAmount(1999)).toBe('One thousand nine hundred ninety-nine dollars');
  });

  it('appends a cents clause only when there is a fractional part', () => {
    expect(spokenMoneyAmount(1999.5)).toBe(
      'One thousand nine hundred ninety-nine dollars and fifty cents',
    );
    expect(spokenMoneyAmount(1999.01)).toBe(
      'One thousand nine hundred ninety-nine dollars and one cent',
    );
  });

  it('speaks zero and singular one dollar', () => {
    expect(spokenMoneyAmount(0)).toBe('Zero dollars');
    expect(spokenMoneyAmount(1)).toBe('One dollar');
  });

  it('speaks a cents-only amount as cents', () => {
    expect(spokenMoneyAmount(0.05)).toBe('Zero dollars and five cents');
  });

  it('prefixes negative amounts with "Negative"', () => {
    expect(spokenMoneyAmount(-42)).toBe('Negative forty-two dollars');
  });

  it('speaks large amounts up to the billions', () => {
    expect(spokenMoneyAmount(5000)).toBe('Five thousand dollars');
    expect(spokenMoneyAmount(1234567)).toBe(
      'One million two hundred thirty-four thousand five hundred sixty-seven dollars',
    );
    expect(spokenMoneyAmount(2000000000)).toBe('Two billion dollars');
  });

  it('uses the correct currency unit names', () => {
    expect(spokenMoneyAmount(5, 'GBP')).toBe('Five pounds');
    expect(spokenMoneyAmount(5.5, 'GBP')).toBe('Five pounds and fifty pence');
    expect(spokenMoneyAmount(5, 'EUR')).toBe('Five euros');
  });

  it('omits the minor unit for zero-decimal currencies like JPY', () => {
    // JPY has no minor unit (exponent 0) — never say "and X sen".
    expect(spokenMoneyAmount(2500, 'JPY')).toBe('Two thousand five hundred yen');
  });

  it('rounds to the currency minor unit rather than reading spurious precision', () => {
    // A float like 10.005 should round to 10.01, not read "zero point five cents".
    expect(spokenMoneyAmount(10.005)).toBe('Ten dollars and one cent');
  });
});

describe('spokenMoney', () => {
  it('speaks a Money value from its minor units', () => {
    expect(spokenMoney({ amountMinorUnits: 199900, currency: 'USD' })).toBe(
      'One thousand nine hundred ninety-nine dollars',
    );
    expect(spokenMoney({ amountMinorUnits: 2500, currency: 'JPY' })).toBe(
      'Two thousand five hundred yen',
    );
  });
});
