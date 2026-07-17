import { describe, expect, it } from 'vitest';
import { verifyBalanceIntegrity } from './balance-integrity';

describe('verifyBalanceIntegrity', () => {
  it('passes when postings net exactly to the derived balance', () => {
    expect(verifyBalanceIntegrity([500_000, -200_000, 100_000], 400_000)).toBe(true);
  });

  it('fails when postings do not net to the derived balance (AC-04 Fatal-tier)', () => {
    expect(verifyBalanceIntegrity([500_000, -200_000, 100_000], 399_999)).toBe(false);
  });

  it('treats an empty ledger as a zero balance', () => {
    expect(verifyBalanceIntegrity([], 0)).toBe(true);
    expect(verifyBalanceIntegrity([], 1)).toBe(false);
  });
});
