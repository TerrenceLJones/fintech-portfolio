import type { CardDeclineReason } from '@clearline/contracts';
import { exceedsRemainingLimit } from './card-limit-policy';
import { isMccAllowed } from './mcc-policy';

export interface CardAuthorizationInput {
  frozen: boolean;
  allowedMccs: readonly string[];
  transactionMcc: string;
  monthlyLimitMinorUnits: number;
  authorizedSpendMinorUnits: number;
  amountMinorUnits: number;
  /**
   * A reported card-status hold (lost/stolen/fraud) that overrides every ordinary check. Present only
   * when a card has been flagged; its true reason is recorded but never shown to the cardholder (AC-07).
   */
  securityHold?: Extract<CardDeclineReason, 'lost_or_stolen' | 'fraud'>;
}

export type CardAuthorizationDecision =
  { approved: true } | { approved: false; reason: CardDeclineReason };

/**
 * The single gate every card authorization passes through server-side (US-CW-014). Checks run in
 * priority order so the most fundamental block wins and each decline maps to exactly one reason: a
 * security hold (lost/stolen/fraud) outranks a freeze, which outranks a merchant-category block,
 * which outranks an insufficient limit. A freeze must take effect immediately here — at the
 * authorization layer, not just in the UI — so no new transaction is approved once frozen (AC-05).
 *
 * The `reason` returned is the TRUE reason, recorded for audit and risk. What the cardholder is
 * allowed to see is decided separately by `cardholderDeclineMessage`, which collapses the sensitive
 * reasons to one generic message (AC-07) — this gate never does that filtering itself.
 */
export function authorizeCardTransaction(input: CardAuthorizationInput): CardAuthorizationDecision {
  if (input.securityHold) return { approved: false, reason: input.securityHold };
  if (input.frozen) return { approved: false, reason: 'frozen' };
  if (!isMccAllowed(input.allowedMccs, input.transactionMcc)) {
    return { approved: false, reason: 'mcc_restricted' };
  }
  if (
    exceedsRemainingLimit(
      input.monthlyLimitMinorUnits,
      input.authorizedSpendMinorUnits,
      input.amountMinorUnits,
    )
  ) {
    return { approved: false, reason: 'insufficient_limit' };
  }
  return { approved: true };
}
