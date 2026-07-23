/**
 * Webhook rules backing Developer settings (US-CW-041 AC-06/07/08/09). Pure — the HTTPS-only URL
 * validation drives both the client's inline error and the mock backend's independent rejection, and
 * the retry schedule + HMAC reference are static documentation the delivery log renders.
 */
import type { WebhookEventOption } from '@clearline/contracts';

/** The signing-secret prefix issued secrets and their masked forms carry (design §19.5). */
export const SIGNING_SECRET_MASK_PREFIX = 'whsec_';

const MASK_BULLETS = 14;

/**
 * Whether `url` is a valid HTTPS endpoint (AC-06). A non-HTTPS scheme is refused (AC-07) — the same
 * check the inline form error and the server-side guard both use, so client and server never diverge.
 */
export function isHttpsWebhookUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  return parsed.protocol === 'https:';
}

/** The masked display form of a signing secret after its one-time reveal (AC-06). */
export function maskSigningSecret(secret: string): string {
  const lastFour = secret.slice(-4);
  return `${SIGNING_SECRET_MASK_PREFIX}${'•'.repeat(MASK_BULLETS)}${lastFour}`;
}

/** The documented exponential-backoff intervals Clearline re-attempts a failed delivery at (AC-08). */
export const WEBHOOK_RETRY_SCHEDULE = ['1m', '5m', '30m', '2h', '8h'] as const;

/** The exact retry-schedule sentence shown beside a failed delivery (AC-08). */
export function retryScheduleText(): string {
  const intervals = WEBHOOK_RETRY_SCHEDULE;
  const list = `${intervals.slice(0, -1).join(', ')}, and ${intervals[intervals.length - 1]}`;
  return `Clearline retries failed deliveries at ${list} intervals.`;
}

/** The events a webhook can subscribe to, with the copy the create form renders (AC-06). */
export const WEBHOOK_EVENT_TYPES: readonly WebhookEventOption[] = [
  {
    event: 'transfer.completed',
    label: 'transfer.completed',
    description: 'A transfer settled successfully.',
  },
  {
    event: 'expense.submitted',
    label: 'expense.submitted',
    description: 'An expense was submitted for approval.',
  },
  {
    event: 'expense.approved',
    label: 'expense.approved',
    description: 'An expense was approved.',
  },
  {
    event: 'card.transaction.declined',
    label: 'card.transaction.declined',
    description: 'A card authorization was declined.',
  },
  {
    event: 'payment.failed',
    label: 'payment.failed',
    description: 'A payment failed to settle.',
  },
];

/**
 * A static Node reference showing how an integrator verifies the `Clearline-Signature` header (AC-09):
 * HMAC-SHA256 over the raw body, hex digest, compared in constant time. Documentation only — Clearline
 * never executes it; the header is read lowercased as `clearline-signature`.
 */
export const HMAC_VERIFICATION_SNIPPET = `// Node · verify an incoming Clearline webhook
const sig = req.headers['clearline-signature'];
const expected = crypto
  .createHmac('sha256', WEBHOOK_SIGNING_SECRET)
  .update(rawBody)
  .digest('hex');
if (!crypto.timingSafeEqual(buf(sig), buf(expected))) {
  throw new Error('Invalid signature');
}`;
