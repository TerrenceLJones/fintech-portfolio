import type { Money } from './money';

/** How funds move to the recipient. ACH is same-country/low-cost; wire is faster/cross-border. */
export type PaymentMethod = 'ach' | 'wire';

/** A recipient account is either open for business or permanently closed (US-CW-008 AC-04). */
export type RecipientAccountStatus = 'active' | 'closed';

/**
 * A known, previously-verified vendor the controller can pay without re-entering account details.
 * Surfaced by the payment context so the New Payment form can resolve balance/limit/recipient checks
 * client-side before any network call (US-CW-008).
 */
export interface PaymentRecipient {
  id: string;
  name: string;
  /** Display-masked account, e.g. '••4188' — never the full number. */
  maskedAccount: string;
  method: PaymentMethod;
  /** ISO 4217 code of the recipient's account currency; drives the cross-currency banner (AC-06). */
  currency: string;
  status: RecipientAccountStatus;
}

/**
 * The account funds are paid from. `availableBalance` is a derived ledger projection — read-only, with
 * no input affordance anywhere in the product (US-CW-007 / US-CW-008). `dailySpent` aggregates today's
 * transfers so the form can enforce the remaining daily headroom (AC-02).
 */
export interface SourceAccount {
  id: string;
  name: string;
  maskedAccount: string;
  currency: string;
  availableBalance: Money;
  dailyLimit: Money;
  dailySpent: Money;
}

/** Everything the New Payment form needs to validate a payment before submitting it. */
export interface PaymentContextResponse {
  source: SourceAccount;
  recipients: PaymentRecipient[];
}

/** Raw account details entered by hand when the recipient isn't a known verified vendor (AC-03/AC-04). */
export interface RecipientAccountInput {
  routingNumber: string;
  accountNumber: string;
}

/**
 * A payment submission. Exactly one of `recipientId` (a verified recipient chosen from the context) or
 * `recipientAccount` (hand-entered details for the server to resolve) is set. The client-generated
 * idempotency key is NOT in the body — it travels in the `Idempotency-Key` request header (US-CW-007).
 */
export interface CreatePaymentRequest {
  recipientId?: string;
  recipientAccount?: RecipientAccountInput;
  amount: Money;
  method: PaymentMethod;
  memo?: string;
}

/**
 * The known payment lifecycle states. On the wire `PaymentIntent.status` is a plain string so a status
 * the client doesn't recognize can still round-trip; the client normalizes it (unknown → 'processing',
 * US-CW-009 AC-03) rather than trusting the raw value directly.
 *   - processing: definitive status not yet known (submitting, polling, or an unrecognized code)
 *   - pending: accepted, awaiting settlement ("Payment submitted — pending")
 *   - pending_review: held for compliance screening — surfaced neutrally, never as "sanctions" (AC-01)
 *   - settled / reversed / failed: terminal
 */
export type PaymentIntentStatus =
  'processing' | 'pending' | 'pending_review' | 'settled' | 'reversed' | 'failed';

export interface PaymentIntent {
  id: string;
  /** Raw server status string — normalize via @clearline/domain-payments before display. */
  status: string;
  amount: Money;
  recipientName: string;
  recipientMasked: string;
  method: PaymentMethod;
  /** ISO 8601 timestamp the intent was created. */
  createdDate: string;
  memo?: string;
  /** Present once reversed (US-CW-009 AC-02) — the reversal date and the append-only ledger linkage. */
  reversedDate?: string;
  /** The immutable original ledger entry; it is never edited or deleted, only offset by a reversing entry. */
  originalEntryId?: string;
  /** The additive reversing ledger entry that offsets the original. */
  reversingEntryId?: string;
}

export interface CreatePaymentResponse {
  intent: PaymentIntent;
}

export interface PaymentIntentResponse {
  intent: PaymentIntent;
}

/**
 * Why a payment was rejected. The client maps each to the design's exact inline copy. `forbidden` is
 * the caller lacking `payments:create`; the rest are per-payment validation failures the server
 * independently re-checks even though the client pre-blocks them (the client is never the boundary).
 */
export type PaymentErrorCode =
  | 'insufficient_balance'
  | 'daily_limit_exceeded'
  | 'recipient_not_found'
  | 'recipient_closed'
  | 'self_transfer'
  | 'idempotency_mismatch'
  | 'forbidden';

export interface PaymentErrorResponse {
  error: PaymentErrorCode;
  /** Present only for insufficient_balance — the derived available balance, for the "Available: $…" copy. */
  availableBalance?: Money;
  /** Present only for daily_limit_exceeded — the configured daily transfer limit, for the message. */
  dailyLimit?: Money;
}

/** A live cross-currency quote (US-CW-008 AC-06): units of `toCurrency` per 1 unit of `fromCurrency`. */
export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
}

export interface ExchangeRateResponse {
  rate: ExchangeRate;
  /** The USD amount converted into the recipient's currency, shown before the user can confirm. */
  convertedAmount: Money;
}
