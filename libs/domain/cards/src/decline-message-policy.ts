import type { CardDeclineReason } from '@clearline/contracts';

/**
 * The generic, security-safe message every sensitive decline collapses to (US-CW-014 AC-07). Kept as
 * an exported constant so the UI and tests assert against the single source of truth, never a
 * re-typed literal.
 */
export const GENERIC_DECLINE_MESSAGE =
  'This card was declined. Please contact support for more information.';

const MCC_MESSAGE = "Transaction declined — this card can't be used at this type of merchant";
const LIMIT_MESSAGE = 'Transaction declined — insufficient limit remaining';
const PER_TRANSACTION_MESSAGE = 'Transaction declined — over the per-transaction limit';

/**
 * The message shown to the CARDHOLDER for a declined authorization, filtered through the security
 * gate (US-CW-014 AC-07). Only a merchant-category or insufficient-limit decline is actionable and
 * safe to state specifically. Every sensitive reason — a frozen card, or one reported
 * lost/stolen/fraudulent — collapses to the identical {@link GENERIC_DECLINE_MESSAGE}, so the UI
 * never tips off a bad actor about why the card really failed. The true reason stays server-side for
 * support and risk (it reaches this function, but is deliberately not surfaced).
 */
export function cardholderDeclineMessage(reason: CardDeclineReason): string {
  switch (reason) {
    case 'mcc_restricted':
      return MCC_MESSAGE;
    case 'insufficient_limit':
      return LIMIT_MESSAGE;
    case 'over_transaction_limit':
      return PER_TRANSACTION_MESSAGE;
    case 'frozen':
    case 'lost_or_stolen':
    case 'fraud':
      return GENERIC_DECLINE_MESSAGE;
  }
}

/**
 * The reason label shown in the Controller's transaction feed for a declined row (US-CW-014
 * AC-03/AC-04). The feed is a Controller surface, so a category or limit block names itself; an
 * MCC block is qualified with the merchant category when known (e.g. 'MCC restricted (Restaurants)').
 * Sensitive holds are not surfaced as feed decline rows in this epic, but are handled here for
 * exhaustiveness so a new caller can't silently drop a reason.
 */
export function feedDeclineLabel(reason: CardDeclineReason, mccLabel?: string): string {
  switch (reason) {
    case 'mcc_restricted':
      return mccLabel ? `MCC restricted (${mccLabel})` : 'MCC restricted';
    case 'insufficient_limit':
      return 'insufficient limit remaining';
    case 'over_transaction_limit':
      return 'over per-transaction limit';
    case 'frozen':
      return 'card frozen';
    case 'lost_or_stolen':
    case 'fraud':
      // The Controller's own feed may name that a security hold blocked it (the cardholder still only
      // ever sees the generic message via `cardholderDeclineMessage`); kept vague — not lost vs stolen
      // vs fraud — so a screen-shared feed doesn't reveal the specific cause. Avoids the redundant
      // "Declined · declined" the feed row would otherwise render.
      return 'security hold';
  }
}
