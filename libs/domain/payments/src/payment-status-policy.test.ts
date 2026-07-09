import { describe, expect, it } from 'vitest';
import { normalizePaymentStatus } from './payment-status-policy';

describe('normalizePaymentStatus', () => {
  it.each(['processing', 'pending', 'pending_review', 'settled', 'reversed', 'failed'] as const)(
    'passes through the recognized status "%s"',
    (raw) => {
      expect(normalizePaymentStatus(raw)).toEqual({ status: raw, recognized: true });
    },
  );

  it('degrades an unrecognized status to a neutral "processing" (US-CW-009 AC-03)', () => {
    expect(normalizePaymentStatus('network_settling')).toEqual({
      status: 'processing',
      recognized: false,
    });
  });

  it('degrades an empty or garbage status to "processing" rather than guessing', () => {
    expect(normalizePaymentStatus('')).toEqual({ status: 'processing', recognized: false });
    expect(normalizePaymentStatus('PENDING')).toEqual({ status: 'processing', recognized: false });
  });
});
