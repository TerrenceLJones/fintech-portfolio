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
} from '@clearline/contracts';
import { hasPermission } from '@clearline/domain-auth';
import { validatePayment } from '@clearline/domain-payments';
import {
  SEED_FX_RATES,
  SEED_INTENTS,
  SEED_RECIPIENTS,
  SEED_SOURCE_ACCOUNT,
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
  | { outcome: 'forbidden' }
  | {
      outcome: 'validation_error';
      reason: PaymentErrorCode;
      availableBalance?: Money;
      dailyLimit?: Money;
    }
  | { outcome: 'idempotency_mismatch' };

export type ReverseOutcome = { outcome: 'ok'; intent: PaymentIntent } | { outcome: 'not_found' };

interface PaymentsSeed {
  source?: SourceAccount;
  recipients?: SeedRecipient[];
  intents?: PaymentIntent[];
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
  private counter = 0;

  constructor(seed: PaymentsSeed = {}) {
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
      return { outcome: 'ok', intent: { ...this.intents.get(seen.intentId)! } };
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

    return this.commitPayment(request, recipient, idempotencyKey, requestHash, actor);
  }

  reverse(intentId: string): ReverseOutcome {
    const intent = this.intents.get(intentId);
    if (!intent) return { outcome: 'not_found' };

    // Duplicate webhook delivery: already reversed → return the existing state, post no second entry.
    if (intent.status === 'reversed') return { outcome: 'ok', intent: { ...intent } };

    const createdDate = now();
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

    // The funds return to the account; the original debit entry is left byte-for-byte intact.
    this.source.availableBalance = {
      ...this.source.availableBalance,
      amountMinorUnits:
        this.source.availableBalance.amountMinorUnits + intent.amount.amountMinorUnits,
    };

    const reversed: PaymentIntent = {
      ...intent,
      status: 'reversed',
      reversedDate: createdDate,
      originalEntryId: intent.originalEntryId ?? `${intentId}:debit`,
      reversingEntryId: reversingEntry.id,
    };
    this.intents.set(intentId, reversed);
    return { outcome: 'ok', intent: { ...reversed } };
  }

  private commitPayment(
    request: CreatePaymentRequest,
    recipient: SeedRecipient,
    idempotencyKey: string,
    requestHash: string,
    actor: PaymentActor,
  ): CreatePaymentOutcome {
    const createdDate = now();
    const intentId = this.nextId('pi');
    const debit: LedgerEntry = {
      id: this.nextId('jrn'),
      intentId,
      kind: 'debit',
      amount: { ...request.amount },
      createdDate,
    };
    const credit: LedgerEntry = {
      id: this.nextId('jrn'),
      intentId,
      kind: 'credit',
      amount: { ...request.amount },
      createdDate,
    };
    this.ledger.push(debit, credit);
    this.auditLog.push({
      id: this.nextId('evt'),
      type: 'payment.created',
      intentId,
      actorId: actor.userId,
      timestamp: createdDate,
    });

    this.source.availableBalance = {
      ...this.source.availableBalance,
      amountMinorUnits:
        this.source.availableBalance.amountMinorUnits - request.amount.amountMinorUnits,
    };
    this.source.dailySpent = {
      ...this.source.dailySpent,
      amountMinorUnits: this.source.dailySpent.amountMinorUnits + request.amount.amountMinorUnits,
    };

    const intent: PaymentIntent = {
      id: intentId,
      // A recipient/transaction that matches a screening rule is held neutrally (US-CW-009 AC-01).
      status: recipient.compliance ? 'pending_review' : 'pending',
      amount: { ...request.amount },
      recipientName: recipient.name,
      recipientMasked: recipient.maskedAccount,
      method: request.method,
      createdDate,
      originalEntryId: debit.id,
      ...(request.memo ? { memo: request.memo } : {}),
    };
    this.intents.set(intentId, intent);
    this.idempotency.set(idempotencyKey, { requestHash, intentId });
    return { outcome: 'ok', intent: { ...intent } };
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
}

function toWireRecipient(recipient: SeedRecipient): PaymentRecipient {
  const { id, name, maskedAccount, method, currency, status } = recipient;
  return { id, name, maskedAccount, method, currency, status };
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

function now(): string {
  return new Date().toISOString();
}
