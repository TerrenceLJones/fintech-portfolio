import type {
  CreatePaymentRequest,
  ExchangeRateResponse,
  Money,
  PaymentContextResponse,
  PaymentErrorCode,
  PaymentIntent,
  PaymentRecipient,
  Permission,
  SourceAccount,
  StepUpChallenge,
  StepUpMethod,
} from '@clearline/contracts';
import { hasPermission } from '@clearline/domain-auth';
import { requiresStepUp, validatePayment } from '@clearline/domain-payments';
import {
  SEED_FX_RATES,
  SEED_INTENTS,
  SEED_RECIPIENTS,
  SEED_SOURCE_ACCOUNT,
  STEP_UP_DESTINATION_EMAIL,
  STEP_UP_DESTINATION_SMS,
  STEP_UP_MAX_ATTEMPTS,
  STEP_UP_OTP_EXPIRED,
  STEP_UP_OTP_TTL_MS,
  STEP_UP_OTP_VALID,
  STEP_UP_THRESHOLD_MINOR_UNITS,
  type SeedRecipient,
} from '../fixtures/payments.fixture';

/** The resolved caller — permissions come from the session (see payments.handlers), never client claims. */
export interface PaymentActor {
  userId: string;
  displayName: string;
  permissions: readonly Permission[];
}

/** An immutable, append-only ledger posting. Reversals add a new `reversal` entry — never edit these. */
export interface LedgerEntry {
  id: string;
  intentId: string;
  kind: 'debit' | 'credit' | 'reversal';
  amount: Money;
  createdDate: string;
}

export interface AuditEvent {
  id: string;
  type: string;
  intentId: string;
  actorId: string;
  timestamp: string;
}

export type CreatePaymentOutcome =
  | { outcome: 'ok'; intent: PaymentIntent }
  // The payment tripped the step-up threshold: an intent is reserved in `requires_action` (no funds
  // moved) and a challenge must be cleared before it commits (US-CW-010 AC-01).
  | { outcome: 'requires_action'; intent: PaymentIntent; challenge: StepUpChallenge }
  | { outcome: 'forbidden' }
  | {
      outcome: 'validation_error';
      reason: PaymentErrorCode;
      availableBalance?: Money;
      dailyLimit?: Money;
    }
  | { outcome: 'idempotency_mismatch' };

export type ReverseOutcome = { outcome: 'ok'; intent: PaymentIntent } | { outcome: 'not_found' };

/** Result of a step-up verify attempt (US-CW-010 AC-02/AC-04/AC-06). */
export type VerifyStepUpOutcome =
  | { outcome: 'verified'; intent: PaymentIntent }
  | { outcome: 'incorrect' }
  | { outcome: 'expired'; challenge: StepUpChallenge }
  | { outcome: 'locked' }
  | { outcome: 'not_found' };

/** Result of a resend / method-switch (US-CW-010 AC-05). */
export type ResendStepUpOutcome =
  { outcome: 'ok'; challenge: StepUpChallenge } | { outcome: 'not_found' };

/**
 * The server-held state behind a live step-up challenge. The one-time `code` and everything needed to
 * commit the reserved payment live here and never cross the wire — only `toPublicChallenge` leaks the
 * intent id, method, and masked destination. `issuedAt` drives the 10-minute expiry; `attempts` drives
 * the wrong-code lockout.
 */
interface StepUpRecord {
  intentId: string;
  method: StepUpMethod;
  destinationMasked: string;
  code: string;
  issuedAt: number;
  attempts: number;
  request: CreatePaymentRequest;
  recipient: SeedRecipient;
  actorId: string;
}

interface PaymentsSeed {
  source?: SourceAccount;
  recipients?: SeedRecipient[];
  intents?: PaymentIntent[];
  /** Overridable clock (epoch ms) so tests can age an OTP past its TTL without real time. */
  clock?: () => number;
}

/**
 * In-memory vendor-payment backend with server-authoritative guardrails. Every submission runs through
 * @clearline/domain-payments' validatePayment — the same rule the client uses to pre-block — so a caller
 * who bypasses the UI still can't over-draw, exceed their daily limit, or pay a closed/own account
 * (US-CW-008). Submissions are exactly-once, keyed by the client's Idempotency-Key (US-CW-007); reversals
 * are modeled as additive ledger entries that never touch the original (US-CW-009). State is per-instance;
 * the app binds to the shared singleton (see shared-payments-service).
 */
export class PaymentsService {
  private readonly source: SourceAccount;
  private readonly recipients: Map<string, SeedRecipient>;
  private readonly intents: Map<string, PaymentIntent>;
  private readonly idempotency = new Map<string, { requestHash: string; intentId: string }>();
  private readonly ledger: LedgerEntry[] = [];
  private readonly auditLog: AuditEvent[] = [];
  /** Live step-up challenges, keyed by the reserved intent id (US-CW-010). */
  private readonly stepUps = new Map<string, StepUpRecord>();
  private readonly clock: () => number;
  private counter = 0;

  constructor(seed: PaymentsSeed = {}) {
    this.clock = seed.clock ?? (() => Date.now());
    const source = seed.source ?? SEED_SOURCE_ACCOUNT;
    this.source = {
      ...source,
      availableBalance: { ...source.availableBalance },
      dailyLimit: { ...source.dailyLimit },
      dailySpent: { ...source.dailySpent },
    };
    this.recipients = new Map((seed.recipients ?? SEED_RECIPIENTS).map((r) => [r.id, { ...r }]));
    this.intents = new Map((seed.intents ?? SEED_INTENTS).map((i) => [i.id, { ...i }]));

    // Seed the immutable original debit entry for each pre-existing (already-settled) intent, so a
    // reversal offsets a real ledger entry rather than an originalEntryId that isn't in the ledger —
    // keeping the append-only reversal math consistent for the demo's settled payments (US-CW-009).
    for (const intent of this.intents.values()) {
      if (intent.originalEntryId) {
        this.ledger.push({
          id: intent.originalEntryId,
          intentId: intent.id,
          kind: 'debit',
          amount: { ...intent.amount },
          createdDate: intent.createdDate,
        });
      }
    }
  }

  getContext(): PaymentContextResponse {
    return {
      source: {
        ...this.source,
        availableBalance: { ...this.source.availableBalance },
        dailyLimit: { ...this.source.dailyLimit },
        dailySpent: { ...this.source.dailySpent },
      },
      recipients: [...this.recipients.values()].map(toWireRecipient),
    };
  }

  getIntent(id: string): PaymentIntent | undefined {
    const intent = this.intents.get(id);
    return intent ? { ...intent } : undefined;
  }

  getLedger(): readonly LedgerEntry[] {
    return this.ledger.map((e) => ({ ...e, amount: { ...e.amount } }));
  }

  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog.map((e) => ({ ...e }));
  }

  getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    amountMinorUnits: number,
  ): ExchangeRateResponse | undefined {
    const rate = SEED_FX_RATES[`${fromCurrency}->${toCurrency}`];
    if (rate === undefined) return undefined;
    return {
      rate: { fromCurrency, toCurrency, rate },
      convertedAmount: {
        amountMinorUnits: Math.round(amountMinorUnits * rate),
        currency: toCurrency,
      },
    };
  }

  createPayment(
    request: CreatePaymentRequest,
    idempotencyKey: string,
    actor: PaymentActor,
  ): CreatePaymentOutcome {
    if (!hasPermission(actor.permissions, 'payments:create')) {
      return { outcome: 'forbidden' };
    }

    // Exactly-once: a replay of the same key returns the original intent; the same key with a changed
    // payload is a genuinely different operation the server refuses (US-CW-007 AC-02/AC-05).
    const requestHash = hashRequest(request);
    const seen = this.idempotency.get(idempotencyKey);
    if (seen) {
      if (seen.requestHash !== requestHash) return { outcome: 'idempotency_mismatch' };
      const existing = this.intents.get(seen.intentId)!;
      // A replay while the intent is still awaiting its step-up re-surfaces the SAME challenge rather
      // than reserving a second one, so a double-submit or a "Retry" reuses one attempt (AC-02/AC-03).
      const record = this.stepUps.get(seen.intentId);
      if (existing.status === 'requires_action' && record) {
        return {
          outcome: 'requires_action',
          intent: { ...existing },
          challenge: toPublicChallenge(record),
        };
      }
      return { outcome: 'ok', intent: { ...existing } };
    }

    const recipient = this.resolveRecipient(request);
    if (recipient === 'not_found') {
      return { outcome: 'validation_error', reason: 'recipient_not_found' };
    }

    const decision = validatePayment({
      amountMinorUnits: request.amount.amountMinorUnits,
      availableBalanceMinorUnits: this.source.availableBalance.amountMinorUnits,
      dailyLimitMinorUnits: this.source.dailyLimit.amountMinorUnits,
      dailySpentMinorUnits: this.source.dailySpent.amountMinorUnits,
      isSelfTransfer: recipient.maskedAccount === this.source.maskedAccount,
      recipientStatus: recipient.status,
    });
    if (!decision.ok) {
      if (decision.reason === 'insufficient_balance') {
        return {
          outcome: 'validation_error',
          reason: decision.reason,
          availableBalance: { ...this.source.availableBalance },
        };
      }
      if (decision.reason === 'daily_limit_exceeded') {
        return {
          outcome: 'validation_error',
          reason: decision.reason,
          dailyLimit: { ...this.source.dailyLimit },
        };
      }
      return { outcome: 'validation_error', reason: decision.reason };
    }

    // Above the risk threshold: reserve the intent in `requires_action` and hand back a challenge
    // rather than moving money now (US-CW-010 AC-01). A doomed payment never reaches here — the
    // balance/limit/recipient checks above run first, so we never challenge a payment we'd only reject.
    if (requiresStepUp(request.amount.amountMinorUnits, STEP_UP_THRESHOLD_MINOR_UNITS)) {
      return this.reserveStepUp(request, recipient, idempotencyKey, requestHash, actor);
    }

    return this.commitPayment(request, recipient, idempotencyKey, requestHash, actor);
  }

  reverse(intentId: string): ReverseOutcome {
    const intent = this.intents.get(intentId);
    if (!intent) return { outcome: 'not_found' };

    // Duplicate webhook delivery: already reversed → return the existing state, post no second entry.
    if (intent.status === 'reversed') return { outcome: 'ok', intent: { ...intent } };

    // A reversal offsets the intent's real posted debit — it never fabricates a ledger id. An intent
    // that never posted a debit (e.g. one still settling on the network) has no funds to return, so we
    // record the reversal for audit but leave the balance untouched rather than crediting from nothing.
    const originalDebit = this.ledger.find((e) => e.intentId === intentId && e.kind === 'debit');

    const createdDate = this.nowIso();
    const reversingEntry: LedgerEntry = {
      id: this.nextId('jrn'),
      intentId,
      kind: 'reversal',
      amount: { ...intent.amount },
      createdDate,
    };
    this.ledger.push(reversingEntry);
    this.auditLog.push({
      id: this.nextId('evt'),
      type: 'payment.reversed',
      intentId,
      actorId: 'system:webhook',
      timestamp: createdDate,
    });

    // The funds that were actually debited return to the account; the original debit is left intact.
    if (originalDebit) {
      this.source.availableBalance = {
        ...this.source.availableBalance,
        amountMinorUnits:
          this.source.availableBalance.amountMinorUnits + originalDebit.amount.amountMinorUnits,
      };
    }

    const reversed: PaymentIntent = {
      ...intent,
      status: 'reversed',
      reversedDate: createdDate,
      ...(originalDebit ? { originalEntryId: originalDebit.id } : {}),
      reversingEntryId: reversingEntry.id,
    };
    this.intents.set(intentId, reversed);
    return { outcome: 'ok', intent: { ...reversed } };
  }

  /**
   * Verifies a step-up OTP against the live challenge for `intentId` (US-CW-010). The checks are
   * ordered so each AC maps to exactly one outcome: a locked challenge short-circuits everything
   * (brute-force guard); an aged or invalidated code is `expired` — the old code is dropped and a fresh
   * challenge issued in the same response (AC-06); a wrong code is `incorrect` and burns an attempt
   * (AC-04, kept distinct from the connectivity failure the client renders on its own, AC-07); the
   * valid code commits the reserved payment exactly once (AC-02).
   */
  verifyStepUp(intentId: string, code: string): VerifyStepUpOutcome {
    const record = this.stepUps.get(intentId);
    if (!record) return { outcome: 'not_found' };

    if (record.attempts >= STEP_UP_MAX_ATTEMPTS) return { outcome: 'locked' };

    const aged = this.clock() - record.issuedAt > STEP_UP_OTP_TTL_MS;
    if (code === STEP_UP_OTP_EXPIRED || aged) {
      // Invalidate the old code by issuing a replacement before we answer (AC-06).
      const challenge = this.issueChallenge(record, record.method);
      return { outcome: 'expired', challenge };
    }

    if (code !== record.code) {
      record.attempts += 1;
      return { outcome: 'incorrect' };
    }

    const intent = this.commitReserved(record);
    this.stepUps.delete(intentId);
    return { outcome: 'verified', intent };
  }

  /**
   * Issues a fresh OTP for a reserved intent — the "Resend" and "Try another method" affordances
   * (US-CW-010 AC-05). Resending resets the wrong-attempt counter and, optionally, switches the
   * delivery channel. The previously issued code is invalidated in the same step.
   */
  resendStepUp(intentId: string, method?: StepUpMethod): ResendStepUpOutcome {
    const record = this.stepUps.get(intentId);
    if (!record) return { outcome: 'not_found' };
    const challenge = this.issueChallenge(record, method ?? record.method);
    return { outcome: 'ok', challenge };
  }

  /** Reserves an intent in `requires_action` and mints its first challenge — no funds move here. */
  private reserveStepUp(
    request: CreatePaymentRequest,
    recipient: SeedRecipient,
    idempotencyKey: string,
    requestHash: string,
    actor: PaymentActor,
  ): CreatePaymentOutcome {
    const createdDate = this.nowIso();
    const intentId = this.nextId('pi');
    const intent: PaymentIntent = {
      id: intentId,
      status: 'requires_action',
      amount: { ...request.amount },
      recipientName: recipient.name,
      recipientMasked: recipient.maskedAccount,
      method: request.method,
      createdDate,
      ...(request.memo ? { memo: request.memo } : {}),
    };
    this.intents.set(intentId, intent);
    // Bind the key now so a duplicate submit replays this same reserved intent rather than reserving a
    // second one (US-CW-010 AC-02/AC-03) — the key threads through the whole challenge lifecycle.
    this.idempotency.set(idempotencyKey, { requestHash, intentId });

    const record: StepUpRecord = {
      intentId,
      method: 'otp_sms',
      destinationMasked: STEP_UP_DESTINATION_SMS,
      code: STEP_UP_OTP_VALID,
      issuedAt: this.clock(),
      attempts: 0,
      request,
      recipient,
      actorId: actor.userId,
    };
    this.stepUps.set(intentId, record);
    return {
      outcome: 'requires_action',
      intent: { ...intent },
      challenge: toPublicChallenge(record),
    };
  }

  /** Mutates a challenge record in place with a fresh code/clock/channel and returns its public view. */
  private issueChallenge(record: StepUpRecord, method: StepUpMethod): StepUpChallenge {
    record.method = method;
    record.destinationMasked =
      method === 'otp_email' ? STEP_UP_DESTINATION_EMAIL : STEP_UP_DESTINATION_SMS;
    record.code = STEP_UP_OTP_VALID;
    record.issuedAt = this.clock();
    record.attempts = 0;
    return toPublicChallenge(record);
  }

  /** Transitions a reserved `requires_action` intent to a committed payment — the deferred debit. */
  private commitReserved(record: StepUpRecord): PaymentIntent {
    const reserved = this.intents.get(record.intentId)!;
    const debit = this.postDebitAndCredit(record.intentId, record.request.amount, record.actorId);
    const committed: PaymentIntent = {
      ...reserved,
      // A recipient/transaction that matches a screening rule is held neutrally (US-CW-009 AC-01).
      status: record.recipient.compliance ? 'pending_review' : 'pending',
      originalEntryId: debit.id,
    };
    this.intents.set(record.intentId, committed);
    return { ...committed };
  }

  private commitPayment(
    request: CreatePaymentRequest,
    recipient: SeedRecipient,
    idempotencyKey: string,
    requestHash: string,
    actor: PaymentActor,
  ): CreatePaymentOutcome {
    const intentId = this.nextId('pi');
    const debit = this.postDebitAndCredit(intentId, request.amount, actor.userId);
    const intent: PaymentIntent = {
      id: intentId,
      // A recipient/transaction that matches a screening rule is held neutrally (US-CW-009 AC-01).
      status: recipient.compliance ? 'pending_review' : 'pending',
      amount: { ...request.amount },
      recipientName: recipient.name,
      recipientMasked: recipient.maskedAccount,
      method: request.method,
      createdDate: debit.createdDate,
      originalEntryId: debit.id,
      ...(request.memo ? { memo: request.memo } : {}),
    };
    this.intents.set(intentId, intent);
    this.idempotency.set(idempotencyKey, { requestHash, intentId });
    return { outcome: 'ok', intent: { ...intent } };
  }

  /**
   * Posts the matching debit + credit for a committing payment, debits the available balance and adds
   * to today's spend, and records the audit event — the shared money-moving step for both an ordinary
   * payment and a step-up payment committing after its challenge clears. Returns the debit entry so the
   * caller can link it as the intent's immutable original ledger posting.
   */
  private postDebitAndCredit(intentId: string, amount: Money, actorId: string): LedgerEntry {
    const createdDate = this.nowIso();
    const debit: LedgerEntry = {
      id: this.nextId('jrn'),
      intentId,
      kind: 'debit',
      amount: { ...amount },
      createdDate,
    };
    const credit: LedgerEntry = {
      id: this.nextId('jrn'),
      intentId,
      kind: 'credit',
      amount: { ...amount },
      createdDate,
    };
    this.ledger.push(debit, credit);
    this.auditLog.push({
      id: this.nextId('evt'),
      type: 'payment.created',
      intentId,
      actorId,
      timestamp: createdDate,
    });

    this.source.availableBalance = {
      ...this.source.availableBalance,
      amountMinorUnits: this.source.availableBalance.amountMinorUnits - amount.amountMinorUnits,
    };
    this.source.dailySpent = {
      ...this.source.dailySpent,
      amountMinorUnits: this.source.dailySpent.amountMinorUnits + amount.amountMinorUnits,
    };
    return debit;
  }

  private resolveRecipient(request: CreatePaymentRequest): SeedRecipient | 'not_found' {
    if (request.recipientId) {
      return this.recipients.get(request.recipientId) ?? 'not_found';
    }
    if (request.recipientAccount) {
      const match = [...this.recipients.values()].find(
        (r) => r.accountNumber === request.recipientAccount!.accountNumber,
      );
      return match ?? 'not_found';
    }
    return 'not_found';
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_${this.counter}`;
  }

  /** ISO timestamp from the (optionally injected) clock, so tests can control payment/OTP timing. */
  private nowIso(): string {
    return new Date(this.clock()).toISOString();
  }
}

function toWireRecipient(recipient: SeedRecipient): PaymentRecipient {
  const { id, name, maskedAccount, method, currency, status } = recipient;
  return { id, name, maskedAccount, method, currency, status };
}

/** The wire-safe view of a challenge — the OTP code and commit context stay server-side. */
function toPublicChallenge(record: StepUpRecord): StepUpChallenge {
  return {
    intentId: record.intentId,
    method: record.method,
    destinationMasked: record.destinationMasked,
  };
}

/** Stable canonical key over the money-moving fields, so a replay is judged same-vs-changed payload. */
function hashRequest(request: CreatePaymentRequest): string {
  return [
    request.method,
    String(request.amount.amountMinorUnits),
    request.amount.currency,
    request.recipientId ?? '',
    request.recipientAccount?.accountNumber ?? '',
    request.recipientAccount?.routingNumber ?? '',
    request.memo ?? '',
  ].join('|');
}
