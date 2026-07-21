/**
 * Accounting integrations managed in Settings → Integrations (US-CW-039). An org connects an
 * accounting provider (QuickBooks / Xero / NetSuite) through a mocked OAuth authorization flow — there
 * is no real accounting backend in the demo — maps its expense categories to the provider's chart of
 * accounts, and runs/monitors syncs. Gated by `integrations:manage` (Controller/Admin/Owner).
 * Disconnecting stops auto-sync but preserves GL mappings and never mutates already-exported records
 * (AC-06). Sync status is always carried as text so the UI pairs it with a glyph, never colour alone.
 */

/** The accounting providers Clearline can connect to; each drives one IntegrationCard (design §19.8). */
export type IntegrationProvider = 'quickbooks' | 'xero' | 'netsuite';

/**
 * A provider connection's state (design §19.8, four states). `syncing` is transient during a Sync now
 * run; `error` is a failed/expired-auth connection that offers Reconnect (AC-04). Never colour-only.
 */
export type IntegrationStatus = 'disconnected' | 'connected' | 'syncing' | 'error';

/** The outcome of a completed sync run, shown in the sync log (AC-05). Partial = some rows unmapped. */
export type SyncOutcome = 'success' | 'partial' | 'failed';

/**
 * A provider integration for one org. `accountEmail` is the authorizing account shown once connected
 * (AC-01); `lastSyncAt` is an ISO-8601 timestamp; `errorMessage` explains an `error` status (AC-04).
 */
export interface Integration {
  provider: IntegrationProvider;
  /** Display name, e.g. "QuickBooks Online". */
  name: string;
  status: IntegrationStatus;
  /** The authorizing account, e.g. "books@acme.com" — present once connected (AC-01). */
  accountEmail?: string;
  /** ISO-8601 timestamp of the last completed sync; absent if never synced. */
  lastSyncAt?: string;
  /** Outcome of the last completed sync (AC-05). */
  lastSyncOutcome?: SyncOutcome;
  /** Human explanation shown on an `error` status (AC-04), e.g. token-expired copy. */
  errorMessage?: string;
}

export interface IntegrationsResponse {
  integrations: Integration[];
}

export interface IntegrationResponse {
  integration: Integration;
}

/** One account in the provider's chart of accounts, offered as a GL-mapping target (AC-02). */
export interface ChartOfAccount {
  id: string;
  name: string;
  /** The provider's GL account code, e.g. "6000" — shown beside the name for disambiguation. */
  code: string;
}

/**
 * One Clearline expense category and the provider GL account it maps to (AC-02). `glAccountId` is
 * absent when the category is "Not mapped" — the UI flags those amber and they downgrade a sync to
 * Partial (AC-05).
 */
export interface GlMappingEntry {
  categoryId: string;
  categoryLabel: string;
  glAccountId?: string;
}

/** GET /api/integrations/:provider/gl-mapping — the current mapping plus the provider's CoA options. */
export interface GlMappingResponse {
  mappings: GlMappingEntry[];
  chartOfAccounts: ChartOfAccount[];
}

/** PUT /api/integrations/:provider/gl-mapping — the full set of category → GL-account assignments. */
export interface UpdateGlMappingRequest {
  mappings: { categoryId: string; glAccountId: string | null }[];
}

/** One completed sync run recorded in the sync log (AC-05). */
export interface SyncLogEntry {
  id: string;
  /** ISO-8601 timestamp the run completed. */
  timestamp: string;
  recordsSynced: number;
  outcome: SyncOutcome;
  /** For a Partial/Failed run, the reader-facing reason (e.g. "2 categories not mapped") (AC-05). */
  detail?: string;
}

export interface SyncLogResponse {
  entries: SyncLogEntry[];
}

/** POST /api/integrations/:provider/sync — the run's result; the client toasts the record count (AC-03). */
export interface SyncResult {
  integration: Integration;
  recordsSynced: number;
  outcome: SyncOutcome;
}

export type IntegrationErrorCode =
  'forbidden_role' | 'unauthenticated' | 'unknown_provider' | 'not_connected' | 'already_connected';

/** Body of a 4xx from an integrations endpoint — the client maps `error` to inline copy. */
export interface IntegrationErrorResponse {
  error: IntegrationErrorCode;
}
