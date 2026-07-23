import { describe, expect, it } from 'vitest';
import {
  HMAC_VERIFICATION_SNIPPET,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_RETRY_SCHEDULE,
  isHttpsWebhookUrl,
  maskSigningSecret,
  retryScheduleText,
} from './webhook-policy';

describe('isHttpsWebhookUrl', () => {
  it('accepts a well-formed HTTPS URL (AC-06)', () => {
    expect(isHttpsWebhookUrl('https://api.acme.co/clearline/webhooks')).toBe(true);
  });

  it('rejects an HTTP (non-HTTPS) URL (AC-07)', () => {
    expect(isHttpsWebhookUrl('http://api.acme.co/webhooks')).toBe(false);
  });

  it('rejects other schemes and malformed input', () => {
    expect(isHttpsWebhookUrl('ftp://api.acme.co')).toBe(false);
    expect(isHttpsWebhookUrl('api.acme.co/webhooks')).toBe(false);
    expect(isHttpsWebhookUrl('')).toBe(false);
    expect(isHttpsWebhookUrl('   ')).toBe(false);
  });
});

describe('retryScheduleText', () => {
  it('names the documented backoff intervals exactly (AC-08)', () => {
    expect(retryScheduleText()).toBe(
      'Clearline retries failed deliveries at 1m, 5m, 30m, 2h, and 8h intervals.',
    );
  });

  it('is derived from the retry schedule constant', () => {
    expect(WEBHOOK_RETRY_SCHEDULE).toEqual(['1m', '5m', '30m', '2h', '8h']);
  });
});

describe('maskSigningSecret', () => {
  it('masks a signing secret to its whsec_ prefix + last four (AC-06)', () => {
    expect(maskSigningSecret('whsec_9f2c7b4e1a3d6cab3f')).toBe('whsec_••••••••••••••ab3f');
  });
});

describe('WEBHOOK_EVENT_TYPES', () => {
  it('offers the events named in the story', () => {
    const events = WEBHOOK_EVENT_TYPES.map((e) => e.event);
    expect(events).toContain('transfer.completed');
    expect(events).toContain('expense.approved');
    expect(events).toContain('card.transaction.declined');
  });
});

describe('HMAC_VERIFICATION_SNIPPET', () => {
  it('is a static HMAC-SHA256 reference over the raw body with a constant-time compare (AC-09)', () => {
    expect(HMAC_VERIFICATION_SNIPPET).toContain("createHmac('sha256', WEBHOOK_SIGNING_SECRET)");
    expect(HMAC_VERIFICATION_SNIPPET).toContain('timingSafeEqual');
    expect(HMAC_VERIFICATION_SNIPPET).toContain('clearline-signature');
  });
});
