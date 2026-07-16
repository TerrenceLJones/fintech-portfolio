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
});
