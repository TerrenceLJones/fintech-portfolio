/**
 * Seed data for Developer settings (US-CW-041). There is no real API gateway or webhook dispatcher in
 * the demo — these constants stand in so the page's key list, scope enforcement, and webhook delivery
 * log (including a failed delivery) can be exercised deterministically. The demo key and signing secret
 * are known plaintext ON PURPOSE: the Beacon copies them so a tester can drive the scope-403 / 401
 * enforcement (AC-03/04). Real keys minted at runtime are random and shown exactly once.
 */
import type { ApiKeyScope, WebhookDelivery, WebhookEventType } from '@clearline/contracts';
import { SEED_ORGANIZATION } from './users.fixture';

/** A seeded API key — its plaintext is retained internally only; only the masked form is ever served. */
export interface SeedApiKey {
  id: string;
  name: string;
  scopes: ApiKeyScope[];
  plaintext: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** A seeded webhook endpoint with its delivery history. */
export interface SeedWebhook {
  id: string;
  url: string;
  events: WebhookEventType[];
  signingSecret: string;
  createdAt: string;
  deliveries: WebhookDelivery[];
}

/** The full developer surface seeded for one org. */
export interface SeedDeveloper {
  orgId: string;
  apiKeys: SeedApiKey[];
  webhooks: SeedWebhook[];
}

/**
 * The demo API key the Beacon exposes for exercising scope enforcement (AC-03). It is a read-only key —
 * `read:transactions` + `read:cards` — so a verify against `write:transfers` is refused with the
 * missing scope named. Its last four (`ab3f`) match the design §19.3 masked example.
 */
export const DEMO_API_KEY_NAME = 'Production — Read Only';
export const DEMO_API_KEY_PLAINTEXT = 'sk_live_9f2c7b4e1a3d6c9e8f2ab3f';
export const DEMO_API_KEY_SCOPES: ApiKeyScope[] = ['read:transactions', 'read:cards'];

/** The demo webhook endpoint + its known signing secret, shown in the Beacon for the HMAC reference. */
export const DEMO_WEBHOOK_URL = 'https://api.acme.co/clearline/webhooks';
export const DEMO_WEBHOOK_SIGNING_SECRET = 'whsec_2b7d9e1f4a6c8b0d3e5f7ab3f';

/** The seeded delivery log — two successes and one failed 503 so the failed-badge + Resend path shows (AC-08). */
const SEED_DELIVERIES: WebhookDelivery[] = [
  {
    id: 'whd_seed_1',
    eventType: 'transfer.completed',
    httpStatus: 200,
    deliveredAt: '2026-07-15T09:41:02.000Z',
    durationMs: 142,
    ok: true,
  },
  {
    id: 'whd_seed_2',
    eventType: 'expense.approved',
    httpStatus: 200,
    deliveredAt: '2026-07-15T08:12:55.000Z',
    durationMs: 98,
    ok: true,
  },
  {
    id: 'whd_seed_3',
    eventType: 'card.transaction.declined',
    httpStatus: 503,
    deliveredAt: '2026-07-15T07:30:11.000Z',
    durationMs: 30000,
    ok: false,
  },
];

/** The developer surface seeded for the demo org — one read-only key and one active webhook. */
export const SEED_DEVELOPER: SeedDeveloper[] = [
  {
    orgId: SEED_ORGANIZATION.id,
    apiKeys: [
      {
        id: 'apikey_seed_1',
        name: DEMO_API_KEY_NAME,
        scopes: DEMO_API_KEY_SCOPES,
        plaintext: DEMO_API_KEY_PLAINTEXT,
        createdAt: '2026-06-01T10:00:00.000Z',
        lastUsedAt: '2026-07-14T22:03:00.000Z',
      },
    ],
    webhooks: [
      {
        id: 'webhook_seed_1',
        url: DEMO_WEBHOOK_URL,
        events: ['transfer.completed', 'expense.approved', 'card.transaction.declined'],
        signingSecret: DEMO_WEBHOOK_SIGNING_SECRET,
        createdAt: '2026-06-01T10:05:00.000Z',
        deliveries: SEED_DELIVERIES,
      },
    ],
  },
];
