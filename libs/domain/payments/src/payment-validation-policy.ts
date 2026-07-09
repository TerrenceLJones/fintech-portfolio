import type { PaymentErrorCode, RecipientAccountStatus } from '@clearline/contracts';

/** True when the amount (minor units) is at or below the available balance. */
export function hasSufficientBalance(
  availableBalanceMinorUnits: number,
  amountMinorUnits: number,
): boolean {
  return amountMinorUnits <= availableBalanceMinorUnits;
}

/** True when today's cumulative spend plus this amount would exceed the daily transfer limit. */
export function exceedsDailyLimit(
  dailyLimitMinorUnits: number,
  dailySpentMinorUnits: number,
  amountMinorUnits: number,
): boolean {
  return dailySpentMinorUnits + amountMinorUnits > dailyLimitMinorUnits;
}

export interface PaymentValidationInput {
  amountMinorUnits: number;
  availableBalanceMinorUnits: number;
  dailyLimitMinorUnits: number;
  dailySpentMinorUnits: number;
  /** The recipient account resolves to the payer's own source account (US-CW-008 AC-05). */
  isSelfTransfer: boolean;
  /**
   * Status of the resolved recipient, when known (a verified recipient picked from the context).
   * Undefined for hand-entered details the server must resolve — a `recipient_not_found` there is
   * decided upstream of this gate, since an unresolvable recipient has no status to check.
   */
  recipientStatus?: RecipientAccountStatus;
}

export type PaymentValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: Extract<
        PaymentErrorCode,
        'insufficient_balance' | 'daily_limit_exceeded' | 'recipient_closed' | 'self_transfer'
      >;
    };

/**
 * The single gate every payment passes through, run client-side to pre-block and server-side to
 * independently reject — the same canApprove pattern (US-CW-006). Checks run in priority order so the
 * caller surfaces the most fundamental reason first: paying the wrong account at all (self-transfer,
 * closed recipient) outranks whether the payer can afford it (balance, then daily limit). The client
 * is never the security boundary — the server re-runs this on submit regardless of what the UI showed.
 */
export function validatePayment(input: PaymentValidationInput): PaymentValidationResult {
  if (input.isSelfTransfer) {
    return { ok: false, reason: 'self_transfer' };
  }
  if (input.recipientStatus === 'closed') {
    return { ok: false, reason: 'recipient_closed' };
  }
  if (!hasSufficientBalance(input.availableBalanceMinorUnits, input.amountMinorUnits)) {
    return { ok: false, reason: 'insufficient_balance' };
  }
  if (
    exceedsDailyLimit(
      input.dailyLimitMinorUnits,
      input.dailySpentMinorUnits,
      input.amountMinorUnits,
    )
  ) {
    return { ok: false, reason: 'daily_limit_exceeded' };
  }
  return { ok: true };
}
