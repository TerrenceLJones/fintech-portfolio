import { describe, expect, it } from 'vitest';
import type { CreatePaymentRequest, Money, SourceAccount } from '@clearline/contracts';
import { PaymentsService, type PaymentActor } from './payments.service';
import { SEED_SOURCE_ACCOUNT } from '../fixtures/payments.fixture';

const authorized: PaymentActor = {
  userId: 'user_1',
  displayName: 'Marcus Okafor',
  permissions: ['payments:create'],
};

function usd(amountMinorUnits: number): Money {
  return { amountMinorUnits, currency: 'USD' };
}

function request(overrides: Partial<CreatePaymentRequest> = {}): CreatePaymentRequest {
  return { recipientId: 'rec_acme', amount: usd(500_000), method: 'ach', ...overrides };
}

function serviceWithSource(source: Partial<SourceAccount>): PaymentsService {
  return new PaymentsService({ source: { ...SEED_SOURCE_ACCOUNT, ...source } });
}

describe('PaymentsService.createPayment — authorization', () => {
  it('forbids a caller without payments:create', () => {
    const service = new PaymentsService();
    const result = service.createPayment(request(), 'key-1', {
      ...authorized,
      permissions: [],
    });
    expect(result).toEqual({ outcome: 'forbidden' });
  });
});

describe('PaymentsService.createPayment — idempotency (US-CW-007)', () => {
  it('is exactly-once: the same key + same payload returns the same intent and moves money once', () => {
    const service = new PaymentsService();
    const first = service.createPayment(request(), 'key-1', authorized);
    const second = service.createPayment(request(), 'key-1', authorized);

    expect(first.outcome).toBe('ok');
    expect(second.outcome).toBe('ok');
    if (first.outcome !== 'ok' || second.outcome !== 'ok') return;
    expect(second.intent.id).toBe(first.intent.id);
    // One debit + one credit for this intent, not two of each.
    expect(service.getLedger().filter((e) => e.intentId === first.intent.id)).toHaveLength(2);
  });

  it('rejects the same key with a changed payload as an idempotency mismatch (AC-05)', () => {
    const service = new PaymentsService();
    service.createPayment(request({ amount: usd(500_000) }), 'key-1', authorized);
    const changed = service.createPayment(request({ amount: usd(525_000) }), 'key-1', authorized);
    expect(changed).toEqual({ outcome: 'idempotency_mismatch' });
  });
});

describe('PaymentsService.createPayment — validation (US-CW-008)', () => {
  it('blocks an unresolvable recipient as not found (AC-03)', () => {
    const service = new PaymentsService();
    const result = service.createPayment(
      request({
        recipientId: undefined,
        recipientAccount: { routingNumber: '021000021', accountNumber: '999999999' },
      }),
      'key-1',
      authorized,
    );
    expect(result).toEqual({ outcome: 'validation_error', reason: 'recipient_not_found' });
  });

  it('rejects a closed recipient (AC-04)', () => {
    const service = new PaymentsService();
    const result = service.createPayment(
      request({ recipientId: 'rec_vertex' }),
      'key-1',
      authorized,
    );
    expect(result).toMatchObject({ outcome: 'validation_error', reason: 'recipient_closed' });
  });

  it('blocks a self-transfer (AC-05)', () => {
    const service = new PaymentsService();
    const result = service.createPayment(request({ recipientId: 'rec_self' }), 'key-1', authorized);
    expect(result).toMatchObject({ outcome: 'validation_error', reason: 'self_transfer' });
  });

  it('blocks an over-balance payment and echoes the available balance (AC-01)', () => {
    const service = serviceWithSource({ availableBalance: usd(300_000) });
    const result = service.createPayment(request({ amount: usd(500_000) }), 'key-1', authorized);
    expect(result).toEqual({
      outcome: 'validation_error',
      reason: 'insufficient_balance',
      availableBalance: usd(300_000),
    });
  });

  it('blocks a payment over the remaining daily limit and echoes the limit (AC-02)', () => {
    const service = serviceWithSource({ dailySpent: usd(1_800_000) });
    const result = service.createPayment(request({ amount: usd(500_000) }), 'key-1', authorized);
    expect(result).toEqual({
      outcome: 'validation_error',
      reason: 'daily_limit_exceeded',
      dailyLimit: usd(2_000_000),
    });
  });
});

describe('PaymentsService.createPayment — happy path & ledger', () => {
  it('creates a pending intent, debits the balance, tracks daily spend, and writes a ledger + audit', () => {
    const service = new PaymentsService();
    const result = service.createPayment(request({ amount: usd(500_000) }), 'key-1', authorized);

    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.intent.status).toBe('pending');
    expect(result.intent.recipientName).toBe('Acme Corp');

    const context = service.getContext();
    expect(context.source.availableBalance.amountMinorUnits).toBe(4_821_000 - 500_000);
    expect(context.source.dailySpent.amountMinorUnits).toBe(500_000);

    // Matching debit and credit postings for this intent + one audit event.
    const ledger = service.getLedger().filter((e) => e.intentId === result.intent.id);
    expect(ledger.filter((e) => e.kind === 'debit')).toHaveLength(1);
    expect(ledger.filter((e) => e.kind === 'credit')).toHaveLength(1);
    expect(service.getAuditLog()).toHaveLength(1);
  });
});

describe('PaymentsService.createPayment — compliance hold (US-CW-009 AC-01)', () => {
  it('routes a compliance-flagged recipient into a neutral pending_review state', () => {
    const service = new PaymentsService();
    const result = service.createPayment(
      request({ recipientId: 'rec_shadow' }),
      'key-1',
      authorized,
    );
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.intent.status).toBe('pending_review');
  });
});

describe('PaymentsService.reverse — append-only reversal (US-CW-009 AC-02)', () => {
  it('posts a new reversing entry, leaves the original entry untouched, and marks the intent reversed', () => {
    const service = new PaymentsService();
    const created = service.createPayment(request({ amount: usd(500_000) }), 'key-1', authorized);
    if (created.outcome !== 'ok') throw new Error('setup failed');

    const originalLedger = service.getLedger().map((e) => ({ ...e }));
    const reversed = service.reverse(created.intent.id);

    expect(reversed.outcome).toBe('ok');
    if (reversed.outcome !== 'ok') return;
    expect(reversed.intent.status).toBe('reversed');
    expect(reversed.intent.reversedDate).toBeTruthy();
    expect(reversed.intent.reversingEntryId).toBeTruthy();

    const afterLedger = service.getLedger();
    // A new reversing entry was appended...
    expect(afterLedger.length).toBe(originalLedger.length + 1);
    expect(afterLedger.some((e) => e.kind === 'reversal')).toBe(true);
    // ...and every original entry is byte-for-byte unchanged.
    for (const original of originalLedger) {
      expect(afterLedger).toContainEqual(original);
    }
  });

  it('is idempotent to a duplicate reversal webhook — no second reversing entry', () => {
    const service = new PaymentsService();
    const created = service.createPayment(request(), 'key-1', authorized);
    if (created.outcome !== 'ok') throw new Error('setup failed');

    service.reverse(created.intent.id);
    const ledgerAfterFirst = service.getLedger().length;
    const second = service.reverse(created.intent.id);

    expect(second.outcome).toBe('ok');
    expect(service.getLedger().length).toBe(ledgerAfterFirst);
  });

  it('returns not_found for an unknown intent', () => {
    const service = new PaymentsService();
    expect(service.reverse('pi_missing')).toEqual({ outcome: 'not_found' });
  });

  it('reverses a pre-seeded settled payment against its seeded original ledger entry', () => {
    const service = new PaymentsService();
    // The seeded settled intent already has its immutable original debit entry in the ledger.
    const seededOriginal = service.getLedger().find((e) => e.id === 'jrn_88a1');
    expect(seededOriginal).toBeDefined();

    const result = service.reverse('pi_settled');
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.intent.status).toBe('reversed');
    expect(result.intent.originalEntryId).toBe('jrn_88a1');
    expect(result.intent.reversingEntryId).toBeTruthy();
    // The seeded original entry is never edited — only offset by the new reversing entry.
    expect(service.getLedger().find((e) => e.id === 'jrn_88a1')).toEqual(seededOriginal);
    expect(service.getLedger().some((e) => e.kind === 'reversal')).toBe(true);
  });
});

describe('PaymentsService.getIntent & getExchangeRate', () => {
  it('returns a seeded intent and undefined for an unknown id', () => {
    const service = new PaymentsService();
    expect(service.getIntent('pi_settled')?.status).toBe('settled');
    expect(service.getIntent('pi_unrecognized')?.status).toBe('network_settling');
    expect(service.getIntent('pi_missing')).toBeUndefined();
  });

  it('converts a USD amount into the recipient currency at the seeded rate (AC-06)', () => {
    const service = new PaymentsService();
    const quote = service.getExchangeRate('USD', 'EUR', 500_000);
    expect(quote?.rate.rate).toBe(0.918);
    expect(quote?.convertedAmount).toEqual({ amountMinorUnits: 459_000, currency: 'EUR' });
  });
});
