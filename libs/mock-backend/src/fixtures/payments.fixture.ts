import type { PaymentIntent, PaymentRecipient, SourceAccount } from '@clearline/contracts';

/**
 * A seeded recipient carries two demo-only fields the wire `PaymentRecipient` never exposes:
 *   - `accountNumber` lets a hand-entered `recipientAccount` resolve to (or fail to match) a known
 *     recipient, so the "not found" path (US-CW-008 AC-03) is exercised by unknown digits.
 *   - `compliance` marks a recipient whose payments enter the neutral "Pending review" hold
 *     (US-CW-009 AC-01) — modeled as data rather than a screening engine for the demo.
 */
export interface SeedRecipient extends PaymentRecipient {
  accountNumber: string;
  compliance?: boolean;
}

/**
 * The demo payer account. Amounts are USD minor units (cents). `availableBalance` is a derived ledger
 * projection (read-only in the UI); `dailySpent` seeds at zero so the happy-path $5,000 payment clears
 * — tests that exercise the balance/limit blocks (US-CW-008 AC-01/AC-02) construct a PaymentsService
 * with their own low-balance / high-daily-spend source.
 */
export const SEED_SOURCE_ACCOUNT: SourceAccount = {
  id: 'acct_operating',
  name: 'Operating',
  maskedAccount: '••4021',
  currency: 'USD',
  availableBalance: { amountMinorUnits: 4_821_000, currency: 'USD' },
  dailyLimit: { amountMinorUnits: 2_000_000, currency: 'USD' },
  dailySpent: { amountMinorUnits: 0, currency: 'USD' },
};

/**
 * Verified vendors, shaped to exercise US-CW-008's recipient checks: Acme is a clean active USD payee
 * (happy path), Vertex is closed (AC-04), Globex is EUR (cross-currency banner, AC-06), Shadow is
 * compliance-flagged (US-CW-009 AC-01), and `rec_self` shares the source account's masked number so a
 * payment to it is a self-transfer (AC-05).
 */
export const SEED_RECIPIENTS: SeedRecipient[] = [
  {
    id: 'rec_acme',
    name: 'Acme Corp',
    maskedAccount: '••4188',
    method: 'ach',
    currency: 'USD',
    status: 'active',
    accountNumber: '000104188',
  },
  {
    id: 'rec_vertex',
    name: 'Vertex Logistics',
    maskedAccount: '••7711',
    method: 'ach',
    currency: 'USD',
    status: 'closed',
    accountNumber: '000107711',
  },
  {
    id: 'rec_globex',
    name: 'Globex GmbH',
    maskedAccount: '••3320',
    method: 'wire',
    currency: 'EUR',
    status: 'active',
    accountNumber: '000103320',
  },
  {
    id: 'rec_shadow',
    name: 'Shadow Holdings',
    maskedAccount: '••9004',
    method: 'wire',
    currency: 'USD',
    status: 'active',
    accountNumber: '000109004',
    compliance: true,
  },
  {
    id: 'rec_self',
    name: 'Operating',
    maskedAccount: '••4021',
    method: 'ach',
    currency: 'USD',
    status: 'active',
    accountNumber: '000104021',
  },
];

/**
 * Pre-existing payment intents for the transaction-detail scenarios (US-CW-009): a settled payment
 * that can be reversed by a webhook (AC-02), and one carrying a status string the client won't
 * recognize (AC-03) so it degrades to a neutral "Processing".
 */
export const SEED_INTENTS: PaymentIntent[] = [
  {
    id: 'pi_settled',
    status: 'settled',
    amount: { amountMinorUnits: 500_000, currency: 'USD' },
    recipientName: 'Acme Corp',
    recipientMasked: '••4188',
    method: 'ach',
    createdDate: '2026-06-26T12:00:00.000Z',
    memo: 'Q2 platform license — INV-20418',
    originalEntryId: 'jrn_88a1',
  },
  {
    id: 'pi_unrecognized',
    status: 'network_settling',
    amount: { amountMinorUnits: 875_000, currency: 'USD' },
    recipientName: 'Brightwave Media',
    recipientMasked: '••2049',
    method: 'wire',
    createdDate: '2026-06-27T09:00:00.000Z',
  },
];

/** Fixed demo FX quotes (US-CW-008 AC-06), keyed 'USD->EUR' etc. Rate = units of target per 1 USD. */
export const SEED_FX_RATES: Record<string, number> = {
  'USD->EUR': 0.918,
  'USD->GBP': 0.79,
};

/**
 * Step-up (3DS-style) demo configuration (US-CW-010). Payments strictly above the threshold trigger an
 * OTP challenge before they commit. A real backend would text a random code; this mock uses fixed,
 * beacon-published codes so a tester can drive every branch deterministically:
 *   - `STEP_UP_OTP_VALID` verifies and commits the payment.
 *   - `STEP_UP_OTP_EXPIRED` forces the expiry path (old code invalidated, a fresh one issued) without
 *     waiting out the real 10-minute clock (AC-06).
 *   - any other 6-digit code is a wrong-code authentication failure (AC-04).
 */
export const STEP_UP_THRESHOLD_MINOR_UNITS = 1_000_000;
export const STEP_UP_OTP_VALID = '424242';
export const STEP_UP_OTP_EXPIRED = '000000';
/** Where the demo OTP is "sent" — only the masked form is ever shown to the user. */
export const STEP_UP_DESTINATION_SMS = '•••-•••-4417';
export const STEP_UP_DESTINATION_EMAIL = 'm•••@clearline.com';
/** Server-side OTP lifetime (AC-06) and the wrong-attempt ceiling before a challenge locks. */
export const STEP_UP_OTP_TTL_MS = 10 * 60 * 1000;
export const STEP_UP_MAX_ATTEMPTS = 5;
