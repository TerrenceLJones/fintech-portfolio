/**
 * Developer Settings — API keys & webhooks, managed in Settings → Developer (US-CW-041). An Admin or
 * Owner issues scope-limited API keys and registers webhook endpoints. Gated by `developer:manage`
 * (Admin | Owner only) — hidden even from a bare Controller, and every route re-checks server-side.
 *
 * This surface is the archetype of the design §19 "secrets shown exactly once" doctrine: a newly
 * created API key and a newly created webhook signing secret are each returned in plaintext EXACTLY
 * ONCE, in the create response, and never again — thereafter only a masked form is ever exposed
 * (AC-01/02/06). There is no re-reveal endpoint anywhere; a lost secret is recovered only by
 * revoke/recreate. API-key scopes are least-privilege: a request that lacks a required scope is
 * refused with the MISSING scope named, never a generic auth error (AC-03).
 */

/** Least-privilege API-key scopes (AC-01/03). Read scopes never grant writes; each is granted explicitly. */
export type ApiKeyScope =
  'read:transactions' | 'read:cards' | 'read:expenses' | 'write:transfers' | 'write:cards';

/** One selectable scope with the copy the create form shows beside its checkbox. */
export interface ApiKeyScopeOption {
  scope: ApiKeyScope;
  label: string;
  description: string;
}

/**
 * An API key as it is safe to display after creation (AC-02): only the masked form
 * (`sk_live_••••••••••••••ab3f`) is ever returned — never the full key. The plaintext is available
 * once, in {@link CreateApiKeyResponse}, and nowhere else.
 */
export interface ApiKeySummary {
  id: string;
  name: string;
  /** Masked display form — the `sk_live_` prefix, 14 bullets, and the last four real characters. */
  maskedKey: string;
  scopes: ApiKeyScope[];
  createdAt: string;
  /** ISO timestamp of last use, or null for a key that has never authenticated a request. */
  lastUsedAt: string | null;
}

/** POST /api/developer/api-keys — create a scoped key (AC-01). */
export interface CreateApiKeyRequest {
  name: string;
  scopes: ApiKeyScope[];
}

/**
 * 201 body of a key creation. `plaintextKey` is the ONLY time the full key is ever returned (AC-01) —
 * it is not persisted in retrievable form and never appears in any later response (AC-02).
 */
export interface CreateApiKeyResponse {
  key: ApiKeySummary;
  plaintextKey: string;
}

/**
 * POST /api/developer/api-keys/verify — models scope + revocation enforcement (AC-03/04). The
 * Developer UI itself makes no scoped calls; this endpoint is how a key presented to the Clearline
 * API is checked, so the enforcement is genuinely exercisable: a revoked/unknown key → 401, a key
 * lacking `requiredScope` → 403 naming the missing scope.
 */
export interface VerifyApiKeyRequest {
  key: string;
  requiredScope: ApiKeyScope;
}

/** 200 body of a successful scope check — the key is active and carries the required scope. */
export interface VerifyApiKeyResponse {
  ok: true;
}

/** The webhook events a subscriber can register for (AC-06). */
export type WebhookEventType =
  | 'transfer.completed'
  | 'expense.approved'
  | 'expense.submitted'
  | 'card.transaction.declined'
  | 'payment.failed';

/** One selectable event with the copy the create form shows beside its checkbox. */
export interface WebhookEventOption {
  event: WebhookEventType;
  label: string;
  description: string;
}

/** A webhook's health, always paired with text — never conveyed by colour alone (AC-08). */
export type WebhookStatus = 'active';

/** One delivery attempt in a webhook's log (AC-08). A non-2xx `httpStatus` has `ok: false`. */
export interface WebhookDelivery {
  id: string;
  eventType: WebhookEventType;
  /** The HTTP status the endpoint returned, or 0 when the endpoint was unreachable. */
  httpStatus: number;
  /** ISO timestamp the attempt was made. */
  deliveredAt: string;
  /** Round-trip time in milliseconds. */
  durationMs: number;
  /** True for a 2xx response — a failed delivery (`ok: false`) shows a red badge + Resend (AC-08). */
  ok: boolean;
  /** True when this attempt was created by a manual Resend rather than the original event (AC-09). */
  resent?: boolean;
}

/**
 * A webhook endpoint as returned to the client. The signing secret is NEVER included — like an API
 * key it is shown once at creation ({@link CreateWebhookResponse}) and only its masked form is
 * exposed thereafter.
 */
export interface WebhookSummary {
  id: string;
  url: string;
  events: WebhookEventType[];
  status: WebhookStatus;
  /** Masked signing secret — `whsec_••••••••••••••ab3f` — for display after the one-time reveal. */
  maskedSigningSecret: string;
  createdAt: string;
  /** Delivery attempts, newest first (AC-08). */
  deliveries: WebhookDelivery[];
}

/** POST /api/developer/webhooks — register an HTTPS endpoint (AC-06). Non-HTTPS is rejected (AC-07). */
export interface CreateWebhookRequest {
  url: string;
  events: WebhookEventType[];
}

/**
 * 201 body of a webhook creation. `signingSecret` is the ONLY time the full secret is ever returned
 * (AC-06); it is used to verify Clearline's HMAC-SHA256 signature and never re-displayed.
 */
export interface CreateWebhookResponse {
  webhook: WebhookSummary;
  signingSecret: string;
}

/** GET /api/developer — the org's API keys and webhooks for the Developer settings page. */
export interface DeveloperResponse {
  apiKeys: ApiKeySummary[];
  webhooks: WebhookSummary[];
}

export type DeveloperErrorCode =
  | 'forbidden_role'
  | 'unauthenticated'
  | 'invalid_name'
  | 'no_scopes'
  | 'invalid_scope'
  | 'invalid_url'
  | 'no_events'
  | 'invalid_event'
  | 'unknown_key'
  | 'unknown_webhook'
  | 'unknown_delivery'
  | 'invalid_key'
  | 'insufficient_scope';

/**
 * Body of a 4xx from a developer endpoint. `detail` names the specific thing — e.g. the missing scope
 * on a 403 from the verify endpoint (AC-03), or the offending URL on a non-HTTPS rejection (AC-07).
 */
export interface DeveloperErrorResponse {
  error: DeveloperErrorCode;
  detail?: string;
}
