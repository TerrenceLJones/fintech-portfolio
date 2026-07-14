import { describe, expect, it } from 'vitest';
import { parseAmountToMinorUnits } from './parse-amount';

describe('parseAmountToMinorUnits', () => {
  it('parses plain, comma-grouped and $-prefixed dollar amounts to cents (default USD)', () => {
    expect(parseAmountToMinorUnits('5000')).toBe(500_000);
    expect(parseAmountToMinorUnits('5,000.00')).toBe(500_000);
    expect(parseAmountToMinorUnits('$5,000.50')).toBe(500_050);
  });

  it('returns null for empty, non-numeric or non-positive input', () => {
    expect(parseAmountToMinorUnits('')).toBeNull();
    expect(parseAmountToMinorUnits('abc')).toBeNull();
    expect(parseAmountToMinorUnits('0')).toBeNull();
    expect(parseAmountToMinorUnits('-5')).toBeNull();
    expect(parseAmountToMinorUnits('.')).toBeNull();
    expect(parseAmountToMinorUnits('1.2.3')).toBeNull();
  });

  it('is currency-aware: strips the currency symbol and uses the right exponent', () => {
    // EUR (2 decimals) — the € symbol is stripped, not rejected.
    expect(parseAmountToMinorUnits('€1,250.75', 'EUR')).toBe(125_075);
    // JPY (0 decimals) — no ×100, and the ¥ symbol is stripped.
    expect(parseAmountToMinorUnits('¥5000', 'JPY')).toBe(5000);
    // BHD (3 decimals).
    expect(parseAmountToMinorUnits('182.05', 'BHD')).toBe(182_050);
  });

  it('rounds input more precise than the currency permits to its minor unit', () => {
    expect(parseAmountToMinorUnits('100.5', 'JPY')).toBe(101);
  });
});
