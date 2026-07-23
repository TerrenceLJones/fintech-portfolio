import type {
  ApiKeyScope,
  ApiKeySummary,
  DeveloperResponse,
  WebhookDelivery,
  WebhookEventType,
  WebhookSummary,
} from '@clearline/contracts';
import {
  API_KEY_MASK_PREFIX,
  SIGNING_SECRET_MASK_PREFIX,
  hasScope,
  maskApiKey,
  maskSigningSecret,
} from '@clearline/domain-developer';
import { SEED_DEVELOPER, type SeedDeveloper } from '../fixtures/developer.fixture';

interface StoredApiKey {
  id: string;
  name: string;
  scopes: ApiKeyScope[];
  /** Internal only — the full secret, retained so the mock verify endpoint can enforce scopes (AC-03). Never serialized. */
  plaintext: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

interface StoredWebhook {
  id: string;
  url: string;
  events: WebhookEventType[];
  /** Internal only — the full signing secret. Never serialized after the one-time reveal. */
  signingSecret: string;
  createdAt: string;
  deliveries: WebhookDelivery[];
}

interface StoredDeveloper {
  apiKeys: StoredApiKey[];
  webhooks: StoredWebhook[];
}

export type CreateApiKeyResult = {
  key: ApiKeySummary;
  plaintextKey: string;
};

export type VerifyApiKeyResult =
  | { outcome: 'ok' }
  | { outcome: 'invalid_key' }
  | { outcome: 'insufficient_scope'; missingScope: ApiKeyScope };

export type CreateWebhookResult = {
  webhook: WebhookSummary;
  signingSecret: string;
};

export type WebhookResult = { outcome: 'ok'; webhook: WebhookSummary } | { outcome: 'not_found' };

export type RevokeResult = { outcome: 'ok' } | { outcome: 'not_found' };

/**
 * In-memory Developer-settings backend for US-CW-041. Each org owns a set of scoped API keys and
 * webhook endpoints. The core doctrine it enforces: the full API key and webhook signing secret are
 * returned in plaintext EXACTLY ONCE (from create) and never again — only a masked form is ever served,
 * and there is no re-reveal path. Scope enforcement (AC-03) and revocation (AC-04) are modelled by a
 * verify method a presented key is checked against. State is per-instance: the app binds the shared
 * singleton; tests construct isolated instances with their own seed, clock, and token generator.
 */
export class DeveloperService {
  private readonly orgs = new Map<string, StoredDeveloper>();
  private readonly now: () => string;
  private readonly randomToken: () => string;
  private seq = 0;

  constructor(
    seed: readonly SeedDeveloper[] = SEED_DEVELOPER,
    now: () => string = () => new Date().toISOString(),
    randomToken: () => string = defaultRandomToken,
  ) {
    this.now = now;
    this.randomToken = randomToken;
    for (const record of seed) {
      this.orgs.set(record.orgId, {
        apiKeys: record.apiKeys.map((k) => ({
          id: k.id,
          name: k.name,
          scopes: [...k.scopes],
          plaintext: k.plaintext,
          createdAt: k.createdAt,
          lastUsedAt: k.lastUsedAt,
          revoked: false,
        })),
        webhooks: record.webhooks.map((w) => ({
          id: w.id,
          url: w.url,
          events: [...w.events],
          signingSecret: w.signingSecret,
          createdAt: w.createdAt,
          deliveries: w.deliveries.map((d) => ({ ...d })),
        })),
      });
    }
  }

  /** The org's active API keys and webhooks for the Developer page — revoked keys are omitted (AC-04). */
  snapshot(orgId: string): DeveloperResponse {
    const store = this.ensure(orgId);
    return {
      apiKeys: store.apiKeys.filter((k) => !k.revoked).map((k) => this.toApiKeySummary(k)),
      webhooks: store.webhooks.map((w) => this.toWebhookSummary(w)),
    };
  }

  /** Mint a scoped key (AC-01). The plaintext is returned once here and never retrievable again (AC-02). */
  createApiKey(orgId: string, name: string, scopes: readonly ApiKeyScope[]): CreateApiKeyResult {
    const store = this.ensure(orgId);
    const plaintext = `${API_KEY_MASK_PREFIX}${this.randomToken()}`;
    const key: StoredApiKey = {
      id: `apikey_${++this.seq}`,
      name,
      scopes: [...scopes],
      plaintext,
      createdAt: this.now(),
      lastUsedAt: null,
      revoked: false,
    };
    store.apiKeys.push(key);
    return { key: this.toApiKeySummary(key), plaintextKey: plaintext };
  }

  /**
   * Revoke a key immediately and permanently (AC-04). Idempotent: revoking an already-revoked key still
   * reports ok (two admins racing a revoke both succeed) — only a key that never existed is not_found.
   */
  revokeApiKey(orgId: string, keyId: string): RevokeResult {
    const key = this.ensure(orgId).apiKeys.find((k) => k.id === keyId);
    if (!key) return { outcome: 'not_found' };
    key.revoked = true;
    return { outcome: 'ok' };
  }

  /**
   * Check a presented key against a required scope (AC-03/04). A revoked or unknown key is invalid_key
   * (→ 401); an active key lacking the scope names the missing one (→ 403). A valid, sufficiently-scoped
   * key stamps lastUsedAt and succeeds.
   */
  verifyApiKey(orgId: string, rawKey: string, requiredScope: ApiKeyScope): VerifyApiKeyResult {
    const key = this.ensure(orgId).apiKeys.find((k) => k.plaintext === rawKey);
    if (!key || key.revoked) return { outcome: 'invalid_key' };
    if (!hasScope(key.scopes, requiredScope)) {
      return { outcome: 'insufficient_scope', missingScope: requiredScope };
    }
    key.lastUsedAt = this.now();
    return { outcome: 'ok' };
  }

  /** Register an HTTPS endpoint (AC-06). The signing secret is returned once and never re-served. */
  createWebhook(
    orgId: string,
    url: string,
    events: readonly WebhookEventType[],
  ): CreateWebhookResult {
    const store = this.ensure(orgId);
    const signingSecret = `${SIGNING_SECRET_MASK_PREFIX}${this.randomToken()}`;
    const webhook: StoredWebhook = {
      id: `webhook_${++this.seq}`,
      url,
      events: [...events],
      signingSecret,
      createdAt: this.now(),
      deliveries: [],
    };
    store.webhooks.push(webhook);
    return { webhook: this.toWebhookSummary(webhook), signingSecret };
  }

  /** Delete a webhook endpoint (AC-06). Deliveries stop; no new events are dispatched. */
  deleteWebhook(orgId: string, webhookId: string): RevokeResult {
    const store = this.ensure(orgId);
    const index = store.webhooks.findIndex((w) => w.id === webhookId);
    if (index === -1) return { outcome: 'not_found' };
    store.webhooks.splice(index, 1);
    return { outcome: 'ok' };
  }

  /**
   * Re-send a delivery's event payload (AC-09). A new log entry is appended with the same outcome as the
   * original — a still-down endpoint fails again, and the original entry is never disturbed.
   */
  resendDelivery(orgId: string, webhookId: string, deliveryId: string): WebhookResult {
    const webhook = this.ensure(orgId).webhooks.find((w) => w.id === webhookId);
    if (!webhook) return { outcome: 'not_found' };
    const original = webhook.deliveries.find((d) => d.id === deliveryId);
    if (!original) return { outcome: 'not_found' };
    const replay: WebhookDelivery = {
      id: `whd_${++this.seq}`,
      eventType: original.eventType,
      httpStatus: original.httpStatus,
      deliveredAt: this.now(),
      durationMs: original.durationMs,
      ok: original.ok,
      resent: true,
    };
    webhook.deliveries.push(replay);
    return { outcome: 'ok', webhook: this.toWebhookSummary(webhook) };
  }

  /**
   * The stored name for a key regardless of revoked state — for the revoke audit label (AC-10). The
   * public snapshot omits revoked keys, so a concurrent/repeat revoke would otherwise lose the name.
   */
  apiKeyName(orgId: string, keyId: string): string | null {
    return this.orgs.get(orgId)?.apiKeys.find((k) => k.id === keyId)?.name ?? null;
  }

  /** The webhook's masked signing secret — for the audit target label, never the full secret (AC-10). */
  maskedSecretForWebhook(orgId: string, webhookId: string): string | null {
    const webhook = this.orgs.get(orgId)?.webhooks.find((w) => w.id === webhookId);
    return webhook ? maskSigningSecret(webhook.signingSecret) : null;
  }

  private ensure(orgId: string): StoredDeveloper {
    let store = this.orgs.get(orgId);
    if (!store) {
      store = { apiKeys: [], webhooks: [] };
      this.orgs.set(orgId, store);
    }
    return store;
  }

  private toApiKeySummary(key: StoredApiKey): ApiKeySummary {
    return {
      id: key.id,
      name: key.name,
      maskedKey: maskApiKey(key.plaintext),
      scopes: [...key.scopes],
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
    };
  }

  private toWebhookSummary(webhook: StoredWebhook): WebhookSummary {
    return {
      id: webhook.id,
      url: webhook.url,
      events: [...webhook.events],
      status: 'active',
      maskedSigningSecret: maskSigningSecret(webhook.signingSecret),
      createdAt: webhook.createdAt,
      deliveries: [...webhook.deliveries].sort((a, b) =>
        b.deliveredAt.localeCompare(a.deliveredAt),
      ),
    };
  }
}

/** A 24-hex-char random token body for a key/secret, using the platform CSPRNG (Node 24 + browser). */
function defaultRandomToken(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
