import type { Money } from './money';

/** A card's lifecycle state as shown in the wallet. Lost/stolen/fraud are decline reasons, not display states. */
export type CardStatus = 'active' | 'frozen';

/**
 * A merchant-category group a card can be restricted to. `code` is the stable key the authorization
 * gate matches on; `label` is the human name shown in chips and the feed (e.g. 'Software').
 */
export interface MerchantCategory {
  code: string;
  label: string;
}

/**
 * A virtual card. The remaining monthly limit is a DERIVED value (monthlyLimit − authorizedSpend),
 * computed client-side via @clearline/domain-cards — it is never sent or persisted as mutable state,
 * so the stored and actual balances can't drift (US-CW-014 AC-02, "derived, not stored"). Only an
 * approved authorization contributes to `authorizedSpend`; a decline never does.
 */
export interface VirtualCard {
  id: string;
  holderName: string;
  /** Two-letter monogram for the card face / avatar, e.g. 'DR'. */
  holderInitials: string;
  /** Last four of the PAN — the full number never crosses the wire. */
  last4: string;
  /** Expiry MM/YY, display only. */
  exp: string;
  monthlyLimit: Money;
  /** Approved spend so far this cycle; remaining = monthlyLimit − authorizedSpend (derived). */
  authorizedSpend: Money;
  status: CardStatus;
  /** MCC codes this card is allowed to transact in; an empty list means unrestricted. */
  allowedMccs: string[];
}

export interface CardListResponse {
  cards: VirtualCard[];
}

export interface CardResponse {
  card: VirtualCard;
}

/** A person a Controller can issue a card to (US-CW-014 AC-01). */
export interface CardholderCandidate {
  id: string;
  name: string;
  initials: string;
  team: string;
}

/** Everything the issuance form needs: who can hold a card and the selectable MCC groups. */
export interface IssueCardContextResponse {
  candidates: CardholderCandidate[];
  merchantCategories: MerchantCategory[];
}

/** A card-issuance submission (US-CW-014 AC-01). The server mints the PAN, expiry, and card id. */
export interface IssueCardRequest {
  holderId: string;
  monthlyLimit: Money;
  allowedMccs: string[];
}

/** Toggle the freeze state. `frozen: true` stops the card authorizing new transactions at once (AC-05). */
export interface FreezeCardRequest {
  frozen: boolean;
}

/**
 * Why a card authorization was declined. Only `mcc_restricted` and `insufficient_limit` may ever be
 * shown to the cardholder verbatim; `frozen`, `lost_or_stolen`, and `fraud` are security-sensitive and
 * MUST collapse to a single generic cardholder message (US-CW-014 AC-07) — see @clearline/domain-cards
 * `cardholderDeclineMessage`. The true reason is still recorded server-side for support and risk.
 */
export type CardDeclineReason =
  'frozen' | 'mcc_restricted' | 'insufficient_limit' | 'lost_or_stolen' | 'fraud';

export type CardTransactionStatus = 'approved' | 'declined';

/**
 * One entry in a card's real-time transaction feed. A declined entry carries its `declineReason` and
 * renders its amount struck through (no funds moved); an approved entry contributes to the card's
 * `authorizedSpend` and so moves the derived remaining limit (US-CW-014 AC-02/AC-03/AC-04).
 */
export interface CardTransaction {
  id: string;
  cardId: string;
  merchantName: string;
  /** Two-letter monogram for the merchant avatar, e.g. 'No' for Notion. */
  merchantInitials: string;
  /** MCC code the merchant transacted under — matched against the card's `allowedMccs`. */
  mcc: string;
  /** Human category label shown in the feed row, e.g. 'Software', 'Restaurants'. */
  mccLabel: string;
  amount: Money;
  /** ISO 8601 timestamp of the authorization. */
  occurredAt: string;
  status: CardTransactionStatus;
  declineReason?: CardDeclineReason;
}

/**
 * A message on the card feed WebSocket (US-CW-014 AC-02). `backlog` is the initial replay of known
 * transactions sent on connect (so a reconnect re-hydrates from a known point); `transaction` is a
 * single live authorization streamed as it happens.
 */
export type CardFeedMessage =
  | { type: 'backlog'; transactions: CardTransaction[] }
  | { type: 'transaction'; transaction: CardTransaction };

export type CardErrorCode = 'forbidden' | 'card_not_found' | 'invalid_limit' | 'invalid_holder';

/** Body of a 4xx from a card endpoint — the client maps `error` to the design's inline copy. */
export interface CardErrorResponse {
  error: CardErrorCode;
}
