import type { PaymentIntentStatus } from '@clearline/contracts';

const RECOGNIZED_STATUSES: readonly PaymentIntentStatus[] = [
  'processing',
  'pending',
  'pending_review',
  'settled',
  'reversed',
  'failed',
];

export interface NormalizedPaymentStatus {
  status: PaymentIntentStatus;
  /** False when the raw wire value wasn't a known status — the caller logs it for engineering triage. */
  recognized: boolean;
}

/**
 * Maps a raw server status string to a known lifecycle state. A value the client doesn't recognize
 * degrades to a neutral "processing" rather than guessing a more specific state (US-CW-009 AC-03);
 * `recognized: false` signals the caller to log the raw value for engineering review without ever
 * surfacing it to the user.
 */
export function normalizePaymentStatus(rawStatus: string): NormalizedPaymentStatus {
  if ((RECOGNIZED_STATUSES as readonly string[]).includes(rawStatus)) {
    return { status: rawStatus as PaymentIntentStatus, recognized: true };
  }
  return { status: 'processing', recognized: false };
}
