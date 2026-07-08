import { describe, expect, it } from 'vitest';
import { requiresKyc } from './ownership-threshold-policy';

describe('requiresKyc', () => {
  it('does not require KYC below 25% ownership', () => {
    expect(requiresKyc(24.99)).toBe(false);
  });

  it('requires KYC at exactly 25% ownership', () => {
    expect(requiresKyc(25)).toBe(true);
  });

  it('requires KYC above 25% ownership', () => {
    expect(requiresKyc(60)).toBe(true);
  });

  it('does not require KYC at 0%', () => {
    expect(requiresKyc(0)).toBe(false);
  });
});
