import { describe, expect, it } from 'vitest';
import { authorizeCardTransaction, type CardAuthorizationInput } from './card-authorization-policy';

/** A baseline authorization that would be approved; each test overrides the field it exercises. */
function baseInput(overrides: Partial<CardAuthorizationInput> = {}): CardAuthorizationInput {
  return {
    frozen: false,
    allowedMccs: ['software', 'office_supplies'],
    transactionMcc: 'software',
    monthlyLimitMinorUnits: 200_000,
    authorizedSpendMinorUnits: 15_000,
    amountMinorUnits: 5_000,
    ...overrides,
  };
}

describe('authorizeCardTransaction', () => {
  it('approves a transaction that clears every gate', () => {
    expect(authorizeCardTransaction(baseInput())).toEqual({ approved: true });
  });

  it('declines with "mcc_restricted" for a disallowed merchant category (AC-03)', () => {
    expect(authorizeCardTransaction(baseInput({ transactionMcc: 'restaurants' }))).toEqual({
      approved: false,
      reason: 'mcc_restricted',
    });
  });

  it('declines with "insufficient_limit" when the amount exceeds the remaining limit (AC-04)', () => {
    expect(
      authorizeCardTransaction(
        baseInput({ authorizedSpendMinorUnits: 195_000, amountMinorUnits: 7_500 }),
      ),
    ).toEqual({ approved: false, reason: 'insufficient_limit' });
  });

  it('declines with "frozen" the moment the card is frozen — before any limit/MCC check (AC-05)', () => {
    // Frozen must block even an otherwise-valid transaction, immediately at the authorization layer.
    expect(authorizeCardTransaction(baseInput({ frozen: true }))).toEqual({
      approved: false,
      reason: 'frozen',
    });
  });

  it('lets a security hold (lost/stolen) outrank a freeze so the true reason is recorded (AC-07)', () => {
    expect(
      authorizeCardTransaction(baseInput({ frozen: true, securityHold: 'lost_or_stolen' })),
    ).toEqual({ approved: false, reason: 'lost_or_stolen' });
  });

  it('prioritises a freeze over an MCC/limit block so the most fundamental reason wins', () => {
    expect(
      authorizeCardTransaction(
        baseInput({ frozen: true, transactionMcc: 'restaurants', amountMinorUnits: 999_999 }),
      ),
    ).toEqual({ approved: false, reason: 'frozen' });
  });

  it('prioritises an MCC block over an insufficient limit', () => {
    expect(
      authorizeCardTransaction(
        baseInput({ transactionMcc: 'restaurants', amountMinorUnits: 999_999 }),
      ),
    ).toEqual({ approved: false, reason: 'mcc_restricted' });
  });

  it('declines with "over_transaction_limit" when a single charge exceeds the per-transaction cap (US-CW-038 AC-01)', () => {
    expect(
      authorizeCardTransaction(
        baseInput({ perTransactionLimitMinorUnits: 50_000, amountMinorUnits: 60_000 }),
      ),
    ).toEqual({ approved: false, reason: 'over_transaction_limit' });
  });

  it('approves a charge at or below the per-transaction cap', () => {
    expect(
      authorizeCardTransaction(
        baseInput({ perTransactionLimitMinorUnits: 50_000, amountMinorUnits: 50_000 }),
      ),
    ).toEqual({ approved: true });
  });

  it('applies no per-transaction cap when the limit is absent', () => {
    expect(authorizeCardTransaction(baseInput({ amountMinorUnits: 999_999_999 }))).not.toEqual({
      approved: false,
      reason: 'over_transaction_limit',
    });
  });

  it('prioritises an MCC block over a per-transaction-limit block', () => {
    expect(
      authorizeCardTransaction(
        baseInput({
          transactionMcc: 'restaurants',
          perTransactionLimitMinorUnits: 1_000,
          amountMinorUnits: 60_000,
        }),
      ),
    ).toEqual({ approved: false, reason: 'mcc_restricted' });
  });

  it('prioritises a per-transaction-limit block over an insufficient monthly limit', () => {
    // Over both the per-transaction cap and the remaining monthly limit — the per-transaction reason wins.
    expect(
      authorizeCardTransaction(
        baseInput({
          perTransactionLimitMinorUnits: 50_000,
          authorizedSpendMinorUnits: 199_000,
          amountMinorUnits: 60_000,
        }),
      ),
    ).toEqual({ approved: false, reason: 'over_transaction_limit' });
  });
});
