import { describe, expect, it } from 'vitest';
import { messageForPaymentError, parseAmountToMinorUnits } from './new-payment-form';

describe('parseAmountToMinorUnits', () => {
  it('parses plain, comma-grouped and $-prefixed dollar amounts to cents', () => {
    expect(parseAmountToMinorUnits('5000')).toBe(500_000);
    expect(parseAmountToMinorUnits('5,000.00')).toBe(500_000);
    expect(parseAmountToMinorUnits('$5,000.50')).toBe(500_050);
  });

  it('returns null for empty, non-numeric or non-positive input', () => {
    expect(parseAmountToMinorUnits('')).toBeNull();
    expect(parseAmountToMinorUnits('abc')).toBeNull();
    expect(parseAmountToMinorUnits('0')).toBeNull();
    expect(parseAmountToMinorUnits('-5')).toBeNull();
  });
});

describe('messageForPaymentError', () => {
  it('includes the available balance for insufficient_balance (AC-01)', () => {
    expect(
      messageForPaymentError('insufficient_balance', {
        availableBalance: { amountMinorUnits: 300_000, currency: 'USD' },
      }),
    ).toBe("You don't have enough available balance for this transfer. Available: $3,000.00.");
  });

  it('includes the daily limit and a path forward for daily_limit_exceeded (AC-02)', () => {
    expect(
      messageForPaymentError('daily_limit_exceeded', {
        dailyLimit: { amountMinorUnits: 2_000_000, currency: 'USD' },
      }),
    ).toBe(
      'This exceeds your daily transfer limit of $20,000.00. Request a higher limit or enter a smaller amount.',
    );
  });

  it('uses neutral, specific copy for each recipient failure', () => {
    expect(messageForPaymentError('recipient_not_found')).toMatch(/couldn't find that recipient/i);
    expect(messageForPaymentError('recipient_closed')).toMatch(/no longer active/i);
    expect(messageForPaymentError('self_transfer')).toBe("You can't transfer to the same account.");
  });

  it('explains an idempotency mismatch as a new payment (AC-05)', () => {
    expect(messageForPaymentError('idempotency_mismatch')).toBe(
      'Something changed since your last attempt — resubmitting as a new payment.',
    );
  });
});
