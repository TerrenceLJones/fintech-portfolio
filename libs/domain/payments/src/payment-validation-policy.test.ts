import { describe, expect, it } from 'vitest';
import {
  exceedsDailyLimit,
  hasSufficientBalance,
  validatePayment,
  type PaymentValidationInput,
} from './payment-validation-policy';

function input(overrides: Partial<PaymentValidationInput> = {}): PaymentValidationInput {
  return {
    amountMinorUnits: 500_000,
    availableBalanceMinorUnits: 4_821_000,
    dailyLimitMinorUnits: 2_000_000,
    dailySpentMinorUnits: 0,
    isSelfTransfer: false,
    recipientStatus: 'active',
    ...overrides,
  };
}

describe('hasSufficientBalance', () => {
  it('is true when the amount is at or below the available balance', () => {
    expect(hasSufficientBalance(300_000, 300_000)).toBe(true);
    expect(hasSufficientBalance(300_001, 300_000)).toBe(true);
  });

  it('is false when the amount exceeds the available balance', () => {
    expect(hasSufficientBalance(300_000, 500_000)).toBe(false);
  });
});

describe('exceedsDailyLimit', () => {
  it('is true when today’s spend plus the new amount exceeds the limit', () => {
    // $18,000 already + $5,000 new = $23,000 > $20,000 limit
    expect(exceedsDailyLimit(2_000_000, 1_800_000, 500_000)).toBe(true);
  });

  it('is false when the running total stays at or under the limit', () => {
    expect(exceedsDailyLimit(2_000_000, 1_500_000, 500_000)).toBe(false);
  });
});

describe('validatePayment', () => {
  it('allows a payment within balance and limit to an active, non-self recipient', () => {
    expect(validatePayment(input())).toEqual({ ok: true });
  });

  it('blocks a self-transfer before any other check', () => {
    // Also over-balance and closed — self_transfer still wins as the most fundamental.
    expect(
      validatePayment(
        input({
          isSelfTransfer: true,
          recipientStatus: 'closed',
          amountMinorUnits: 9_999_999,
        }),
      ),
    ).toEqual({ ok: false, reason: 'self_transfer' });
  });

  it('blocks a closed recipient before balance/limit checks', () => {
    expect(
      validatePayment(input({ recipientStatus: 'closed', amountMinorUnits: 9_999_999 })),
    ).toEqual({ ok: false, reason: 'recipient_closed' });
  });

  it('blocks insufficient balance', () => {
    expect(
      validatePayment(input({ availableBalanceMinorUnits: 300_000, amountMinorUnits: 500_000 })),
    ).toEqual({ ok: false, reason: 'insufficient_balance' });
  });

  it('blocks a payment that exceeds the daily transfer limit', () => {
    expect(
      validatePayment(
        input({
          dailyLimitMinorUnits: 2_000_000,
          dailySpentMinorUnits: 1_800_000,
          amountMinorUnits: 500_000,
        }),
      ),
    ).toEqual({ ok: false, reason: 'daily_limit_exceeded' });
  });

  it('prefers insufficient_balance over daily_limit_exceeded when both fail', () => {
    expect(
      validatePayment(
        input({
          availableBalanceMinorUnits: 100_000,
          dailyLimitMinorUnits: 2_000_000,
          dailySpentMinorUnits: 1_900_000,
          amountMinorUnits: 500_000,
        }),
      ),
    ).toEqual({ ok: false, reason: 'insufficient_balance' });
  });

  it('treats an undefined recipient status as not-closed (server resolves not-found separately)', () => {
    expect(validatePayment(input({ recipientStatus: undefined }))).toEqual({ ok: true });
  });
});
