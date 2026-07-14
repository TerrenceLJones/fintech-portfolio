import { describe, expect, it } from 'vitest';
import type { CreatePaymentRequest, Money } from '@clearline/contracts';
import { PaymentsService, type PaymentActor } from './payments.service';
import {
  STEP_UP_MAX_ATTEMPTS,
  STEP_UP_OTP_EXPIRED,
  STEP_UP_OTP_TTL_MS,
  STEP_UP_OTP_VALID,
} from '../fixtures/payments.fixture';

const authorized: PaymentActor = {
  userId: 'user_1',
  displayName: 'Marcus Okafor',
  permissions: ['payments:create'],
};

function usd(amountMinorUnits: number): Money {
  return { amountMinorUnits, currency: 'USD' };
}

/** A $12,000 payment to Acme — strictly above the $10,000 step-up threshold. */
function highValue(overrides: Partial<CreatePaymentRequest> = {}): CreatePaymentRequest {
  return { recipientId: 'rec_acme', amount: usd(1_200_000), method: 'ach', ...overrides };
}

describe('PaymentsService.createPayment — step-up threshold (US-CW-010 AC-01)', () => {
  it('reserves a requires_action intent and issues a challenge for a payment over the threshold', () => {
    const service = new PaymentsService();
    const result = service.createPayment(highValue(), 'key-1', authorized);

    expect(result.outcome).toBe('requires_action');
    if (result.outcome !== 'requires_action') return;
    expect(result.intent.status).toBe('requires_action');
    expect(result.challenge.intentId).toBe(result.intent.id);
    expect(result.challenge.method).toBe('otp_sms');
    expect(result.challenge.destinationMasked).toBeTruthy();
  });

  it('does NOT move money while a payment is awaiting step-up (AC-03)', () => {
    const service = new PaymentsService();
    const before = service.getContext().source.availableBalance.amountMinorUnits;

    const result = service.createPayment(highValue(), 'key-1', authorized);
    expect(result.outcome).toBe('requires_action');

    // Balance untouched and no ledger postings until the challenge is cleared.
    expect(service.getContext().source.availableBalance.amountMinorUnits).toBe(before);
    if (result.outcome !== 'requires_action') return;
    expect(service.getLedger().filter((e) => e.intentId === result.intent.id)).toHaveLength(0);
  });

  it('commits straight through (no challenge) at exactly the threshold', () => {
    const service = new PaymentsService();
    const result = service.createPayment(
      highValue({ amount: usd(1_000_000) }),
      'key-1',
      authorized,
    );
    expect(result.outcome).toBe('ok');
  });

  it('still validates balance/limits before reserving a step-up (never challenges a doomed payment)', () => {
    const service = new PaymentsService({
      source: { ...new PaymentsService().getContext().source, availableBalance: usd(500_000) },
    });
    const result = service.createPayment(highValue(), 'key-1', authorized);
    expect(result).toMatchObject({ outcome: 'validation_error', reason: 'insufficient_balance' });
  });

  it('replays the same reserved intent for a duplicate submit with the same key (AC-02/AC-03)', () => {
    const service = new PaymentsService();
    const first = service.createPayment(highValue(), 'key-1', authorized);
    const second = service.createPayment(highValue(), 'key-1', authorized);
    if (first.outcome !== 'requires_action' || second.outcome !== 'requires_action') {
      throw new Error('expected both to require action');
    }
    expect(second.intent.id).toBe(first.intent.id);
  });
});

describe('PaymentsService.verifyStepUp (US-CW-010)', () => {
  function reserve(service: PaymentsService, key = 'key-1') {
    const result = service.createPayment(highValue(), key, authorized);
    if (result.outcome !== 'requires_action') throw new Error('setup: expected requires_action');
    return result.intent.id;
  }

  it('commits the payment on the correct code, preserving the original key (AC-02)', () => {
    const service = new PaymentsService();
    const before = service.getContext().source.availableBalance.amountMinorUnits;
    const intentId = reserve(service);

    const result = service.verifyStepUp(intentId, STEP_UP_OTP_VALID);
    expect(result.outcome).toBe('verified');
    if (result.outcome !== 'verified') return;
    expect(result.intent.status).toBe('pending');

    // The debit lands now — exactly once — and re-submitting the ORIGINAL key returns this same intent.
    expect(service.getContext().source.availableBalance.amountMinorUnits).toBe(before - 1_200_000);
    const replay = service.createPayment(highValue(), 'key-1', authorized);
    expect(replay.outcome).toBe('ok');
    if (replay.outcome !== 'ok') return;
    expect(replay.intent.id).toBe(intentId);
    expect(
      service.getLedger().filter((e) => e.intentId === intentId && e.kind === 'debit'),
    ).toHaveLength(1);
  });

  it('rejects a wrong code as an authentication failure without committing (AC-04)', () => {
    const service = new PaymentsService();
    const before = service.getContext().source.availableBalance.amountMinorUnits;
    const intentId = reserve(service);

    const result = service.verifyStepUp(intentId, '111111');
    expect(result).toMatchObject({ outcome: 'incorrect' });
    // Still awaiting action, no money moved.
    expect(service.getIntent(intentId)?.status).toBe('requires_action');
    expect(service.getContext().source.availableBalance.amountMinorUnits).toBe(before);
  });

  it('treats an expired code as expired, invalidating it and issuing a NEW challenge before responding (AC-06)', () => {
    const service = new PaymentsService();
    const intentId = reserve(service);

    const result = service.verifyStepUp(intentId, STEP_UP_OTP_EXPIRED);
    expect(result.outcome).toBe('expired');
    if (result.outcome !== 'expired') return;
    // A fresh challenge is handed back...
    expect(result.challenge.intentId).toBe(intentId);
    // ...and the old (expired) code no longer verifies — it was invalidated server-side.
    expect(service.verifyStepUp(intentId, STEP_UP_OTP_EXPIRED).outcome).toBe('expired');
    // The valid code still works on the refreshed challenge.
    expect(service.verifyStepUp(intentId, STEP_UP_OTP_VALID).outcome).toBe('verified');
  });

  it('expires a code that has aged past its TTL, via the injectable clock (AC-06)', () => {
    let now = 0;
    const service = new PaymentsService({ clock: () => now });
    const intentId = reserve(service);

    now = STEP_UP_OTP_TTL_MS + 1;
    expect(service.verifyStepUp(intentId, STEP_UP_OTP_VALID).outcome).toBe('expired');
  });

  it('locks the challenge after too many wrong attempts (inferred brute-force guard)', () => {
    const service = new PaymentsService();
    const intentId = reserve(service);

    for (let i = 0; i < STEP_UP_MAX_ATTEMPTS; i += 1) {
      service.verifyStepUp(intentId, '111111');
    }
    // The next attempt — even with the correct code — is locked out.
    expect(service.verifyStepUp(intentId, STEP_UP_OTP_VALID).outcome).toBe('locked');
  });

  it('returns not_found for an unknown intent', () => {
    const service = new PaymentsService();
    expect(service.verifyStepUp('pi_missing', STEP_UP_OTP_VALID)).toEqual({ outcome: 'not_found' });
  });
});

describe('PaymentsService.resendStepUp (US-CW-010 AC-05/AC-06)', () => {
  function reserve(service: PaymentsService) {
    const result = service.createPayment(highValue(), 'key-1', authorized);
    if (result.outcome !== 'requires_action') throw new Error('setup: expected requires_action');
    return result.intent.id;
  }

  it('issues a fresh challenge and resets the wrong-attempt counter', () => {
    const service = new PaymentsService();
    const intentId = reserve(service);
    // Burn some attempts, then resend.
    service.verifyStepUp(intentId, '111111');
    service.verifyStepUp(intentId, '111111');

    const result = service.resendStepUp(intentId);
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.challenge.intentId).toBe(intentId);

    // A full run of wrong attempts is available again — the counter reset.
    for (let i = 0; i < STEP_UP_MAX_ATTEMPTS - 1; i += 1) {
      expect(service.verifyStepUp(intentId, '111111').outcome).toBe('incorrect');
    }
  });

  it('switches the delivery channel when a method is requested (AC-04 "use a different method")', () => {
    const service = new PaymentsService();
    const intentId = reserve(service);
    const result = service.resendStepUp(intentId, 'otp_email');
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.challenge.method).toBe('otp_email');
  });

  it('returns not_found for an unknown intent', () => {
    const service = new PaymentsService();
    expect(service.resendStepUp('pi_missing')).toEqual({ outcome: 'not_found' });
  });
});
