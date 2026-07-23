import { describe, expect, it } from 'vitest';
import { DeveloperService } from './developer.service';
import {
  DEMO_API_KEY_PLAINTEXT,
  SEED_DEVELOPER,
  type SeedDeveloper,
} from '../fixtures/developer.fixture';

const ORG = 'org_test';
let counter = 0;
const fixedNow = () => '2026-07-22T00:00:00.000Z';
const seqToken = () => `token${(counter += 1).toString().padStart(4, '0')}`;

function emptyService() {
  counter = 0;
  return new DeveloperService([{ orgId: ORG, apiKeys: [], webhooks: [] }], fixedNow, seqToken);
}

const SEED_ORG = SEED_DEVELOPER[0]!.orgId;
function seededService() {
  counter = 0;
  return new DeveloperService(SEED_DEVELOPER as SeedDeveloper[], fixedNow, seqToken);
}

describe('createApiKey (AC-01/02)', () => {
  it('returns the plaintext once and lists only the masked form thereafter', () => {
    const service = emptyService();
    const { key, plaintextKey } = service.createApiKey(ORG, 'Prod', ['read:transactions']);

    expect(plaintextKey).toMatch(/^sk_live_/);
    expect(key.maskedKey).toMatch(/^sk_live_•{14}.{4}$/);
    expect(key.maskedKey).not.toBe(plaintextKey);

    const snapshot = service.snapshot(ORG);
    expect(snapshot.apiKeys).toHaveLength(1);
    // The plaintext never appears anywhere in a subsequent read (AC-02).
    expect(JSON.stringify(snapshot)).not.toContain(plaintextKey);
  });
});

describe('revokeApiKey (AC-04)', () => {
  it('removes the key from the active list and 401s a verify against it', () => {
    const service = emptyService();
    const { key, plaintextKey } = service.createApiKey(ORG, 'Prod', ['read:transactions']);

    expect(service.revokeApiKey(ORG, key.id)).toEqual({ outcome: 'ok' });
    expect(service.snapshot(ORG).apiKeys).toHaveLength(0);
    expect(service.verifyApiKey(ORG, plaintextKey, 'read:transactions')).toEqual({
      outcome: 'invalid_key',
    });
  });

  it('is idempotent — revoking an already-revoked key still reports ok', () => {
    const service = emptyService();
    const { key } = service.createApiKey(ORG, 'Prod', ['read:transactions']);
    service.revokeApiKey(ORG, key.id);
    expect(service.revokeApiKey(ORG, key.id)).toEqual({ outcome: 'ok' });
  });

  it('reports not_found for a key that never existed', () => {
    expect(emptyService().revokeApiKey(ORG, 'apikey_missing')).toEqual({ outcome: 'not_found' });
  });

  it('resolves the key name even after revocation, for the audit label (AC-10)', () => {
    const service = emptyService();
    const { key } = service.createApiKey(ORG, 'Prod', ['read:transactions']);
    service.revokeApiKey(ORG, key.id);
    // The active snapshot no longer lists it, but apiKeyName still returns the name.
    expect(service.snapshot(ORG).apiKeys).toHaveLength(0);
    expect(service.apiKeyName(ORG, key.id)).toBe('Prod');
    expect(service.apiKeyName(ORG, 'apikey_missing')).toBeNull();
  });
});

describe('verifyApiKey (AC-03)', () => {
  it('names the missing scope when the key lacks it', () => {
    const service = seededService();
    // The seeded demo key is read-only.
    expect(service.verifyApiKey(SEED_ORG, DEMO_API_KEY_PLAINTEXT, 'write:transfers')).toEqual({
      outcome: 'insufficient_scope',
      missingScope: 'write:transfers',
    });
  });

  it('succeeds for a key that carries the required scope', () => {
    const service = seededService();
    expect(service.verifyApiKey(SEED_ORG, DEMO_API_KEY_PLAINTEXT, 'read:transactions')).toEqual({
      outcome: 'ok',
    });
  });

  it('is invalid_key for an unknown key', () => {
    expect(seededService().verifyApiKey(SEED_ORG, 'sk_live_nope', 'read:cards')).toEqual({
      outcome: 'invalid_key',
    });
  });
});

describe('webhooks (AC-06/09)', () => {
  it('returns the signing secret once and only a masked form thereafter', () => {
    const service = emptyService();
    const { webhook, signingSecret } = service.createWebhook(ORG, 'https://x.example.com/hooks', [
      'transfer.completed',
    ]);
    expect(signingSecret).toMatch(/^whsec_/);
    expect(webhook.maskedSigningSecret).toMatch(/^whsec_•{14}.{4}$/);
    expect(JSON.stringify(service.snapshot(ORG))).not.toContain(signingSecret);
  });

  it('appends a resend entry with the same outcome as the original, preserving the original (AC-09)', () => {
    const service = seededService();
    const webhook = service.snapshot(SEED_ORG).webhooks[0]!;
    const failed = webhook.deliveries.find((d) => !d.ok)!;
    const before = webhook.deliveries.length;

    const result = service.resendDelivery(SEED_ORG, webhook.id, failed.id);
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.webhook.deliveries).toHaveLength(before + 1);
    const resent = result.webhook.deliveries.find((d) => d.resent)!;
    expect(resent.ok).toBe(failed.ok);
    expect(resent.eventType).toBe(failed.eventType);
    // The original entry is untouched.
    expect(result.webhook.deliveries.some((d) => d.id === failed.id)).toBe(true);
  });

  it('deletes a webhook and reports not_found for an unknown one', () => {
    const service = seededService();
    const webhook = service.snapshot(SEED_ORG).webhooks[0]!;
    expect(service.deleteWebhook(SEED_ORG, webhook.id)).toEqual({ outcome: 'ok' });
    expect(service.snapshot(SEED_ORG).webhooks).toHaveLength(0);
    expect(service.deleteWebhook(SEED_ORG, 'webhook_missing')).toEqual({ outcome: 'not_found' });
  });
});

describe('snapshot', () => {
  it('sorts deliveries newest-first', () => {
    const service = seededService();
    const deliveries = service.snapshot(SEED_ORG).webhooks[0]!.deliveries;
    const timestamps = deliveries.map((d) => d.deliveredAt);
    expect([...timestamps]).toEqual([...timestamps].sort((a, b) => b.localeCompare(a)));
  });
});
