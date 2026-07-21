import type {
  ChartOfAccount,
  GlMappingEntry,
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  SyncLogEntry,
  SyncOutcome,
  SyncResult,
} from '@clearline/contracts';
import {
  INTEGRATION_CATALOGUE,
  INTEGRATION_PROVIDER_ORDER,
  syncOutcomeForMapping,
} from '@clearline/domain-integrations';
import {
  DEMO_SYNC_RECORD_COUNT,
  GL_MAPPING_CATEGORIES,
  SEED_CHART_OF_ACCOUNTS,
  SEED_INTEGRATIONS,
  SEED_QUICKBOOKS_GL_MAPPING,
  type SeedIntegration,
} from '../fixtures/integrations.fixture';

interface StoredIntegration {
  orgId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  accountEmail?: string;
  lastSyncAt?: string;
  lastSyncOutcome?: SyncOutcome;
  errorMessage?: string;
  /** categoryId → glAccountId; a category absent from the map is "Not mapped" (AC-02). */
  glMapping: Map<string, string>;
  syncLog: SyncLogEntry[];
}

export type ConnectOutcome =
  { outcome: 'ok'; integration: Integration } | { outcome: 'already_connected' };

export type SyncOutcomeResult =
  { outcome: 'ok'; result: SyncResult } | { outcome: 'not_connected' };

export type SimpleIntegrationOutcome =
  { outcome: 'ok'; integration: Integration } | { outcome: 'not_connected' };

/** The two demo categories a partial sync leaves behind, subtracted from the clean record count. */
const PARTIAL_SYNC_PENALTY = 6;

/**
 * In-memory accounting-integration backend for US-CW-039. Each org has a QuickBooks/Xero/NetSuite
 * integration whose lifecycle — connect via mocked OAuth (AC-01), configure GL mapping (AC-02), Sync
 * now (AC-03), reconnect from an error (AC-04), review the sync log (AC-05), and disconnect (AC-06) —
 * is modelled without a real accounting backend. Disconnect preserves the GL mapping so a reconnect
 * restores it, and never touches already-recorded sync-log history. State is per-instance: the app
 * binds the shared singleton; tests construct isolated instances with their own seed and clock.
 */
export class IntegrationsService {
  private readonly integrations = new Map<string, StoredIntegration>();
  private readonly chartOfAccounts: ChartOfAccount[];
  private readonly now: () => string;
  private syncCounter = 0;

  constructor(
    seed: readonly SeedIntegration[] = SEED_INTEGRATIONS,
    chartOfAccounts: ChartOfAccount[] = SEED_CHART_OF_ACCOUNTS,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.chartOfAccounts = chartOfAccounts;
    this.now = now;
    for (const record of seed) {
      const glMapping = new Map<string, string>();
      if (record.provider === 'quickbooks') {
        for (const [categoryId, glAccountId] of Object.entries(SEED_QUICKBOOKS_GL_MAPPING)) {
          glMapping.set(categoryId, glAccountId);
        }
      }
      this.integrations.set(this.key(record.orgId, record.provider), {
        orgId: record.orgId,
        provider: record.provider,
        status: record.status,
        accountEmail: record.accountEmail,
        lastSyncAt: record.lastSyncAt,
        lastSyncOutcome: record.lastSyncOutcome,
        errorMessage: record.errorMessage,
        glMapping,
        syncLog:
          record.provider === 'quickbooks' && record.lastSyncAt
            ? [
                {
                  id: 'sync_seed_qb',
                  timestamp: record.lastSyncAt,
                  recordsSynced: DEMO_SYNC_RECORD_COUNT,
                  outcome: record.lastSyncOutcome ?? 'success',
                },
              ]
            : [],
      });
    }
  }

  /** Every provider in render order, materialising a disconnected default for any not yet seeded. */
  list(orgId: string): Integration[] {
    return INTEGRATION_PROVIDER_ORDER.map((provider) => {
      const stored = this.integrations.get(this.key(orgId, provider));
      return stored ? this.toWire(stored) : this.disconnectedWire(provider);
    });
  }

  /** The GL mapping table for a provider — every category, with its GL account if mapped (AC-02). */
  getGlMapping(
    orgId: string,
    provider: IntegrationProvider,
  ): {
    mappings: GlMappingEntry[];
    chartOfAccounts: ChartOfAccount[];
  } {
    const stored = this.integrations.get(this.key(orgId, provider));
    const glMapping = stored?.glMapping ?? new Map<string, string>();
    return {
      mappings: GL_MAPPING_CATEGORIES.map((category) => {
        const glAccountId = glMapping.get(category.id);
        return {
          categoryId: category.id,
          categoryLabel: category.label,
          ...(glAccountId ? { glAccountId } : {}),
        };
      }),
      chartOfAccounts: [...this.chartOfAccounts],
    };
  }

  /** Replace a provider's category → GL-account assignments (AC-02). A null target clears the row. */
  updateGlMapping(
    orgId: string,
    provider: IntegrationProvider,
    entries: readonly { categoryId: string; glAccountId: string | null }[],
  ): SimpleIntegrationOutcome {
    const stored = this.ensureConnected(orgId, provider);
    if (!stored) return { outcome: 'not_connected' };
    for (const entry of entries) {
      if (entry.glAccountId) stored.glMapping.set(entry.categoryId, entry.glAccountId);
      else stored.glMapping.delete(entry.categoryId);
    }
    return { outcome: 'ok', integration: this.toWire(stored) };
  }

  /** Complete a mocked OAuth authorization — the integration lands Connected with a "just now" sync (AC-01). */
  connect(orgId: string, provider: IntegrationProvider): ConnectOutcome {
    const existing = this.integrations.get(this.key(orgId, provider));
    if (existing && existing.status === 'connected') return { outcome: 'already_connected' };
    const stored: StoredIntegration = existing ?? {
      orgId,
      provider,
      status: 'connected',
      glMapping: new Map<string, string>(),
      syncLog: [],
    };
    stored.status = 'connected';
    stored.accountEmail = existing?.accountEmail ?? `sync@${provider}.example.com`;
    stored.lastSyncAt = this.now();
    stored.lastSyncOutcome = 'success';
    stored.errorMessage = undefined;
    this.integrations.set(this.key(orgId, provider), stored);
    return { outcome: 'ok', integration: this.toWire(stored) };
  }

  /**
   * Run a sync (AC-03). A connected provider exports the demo record count — downgraded to Partial when
   * a category is unmapped (AC-05). A provider in `error` re-attempts and fails again (AC-04). A
   * disconnected provider can't sync. Every run appends a sync-log entry.
   */
  syncNow(orgId: string, provider: IntegrationProvider): SyncOutcomeResult {
    const stored = this.integrations.get(this.key(orgId, provider));
    if (!stored || stored.status === 'disconnected') return { outcome: 'not_connected' };

    if (stored.status === 'error') {
      this.appendLog(stored, 0, 'failed', 'QuickBooks connection may need to be refreshed.');
      return {
        outcome: 'ok',
        result: { integration: this.toWire(stored), recordsSynced: 0, outcome: 'failed' },
      };
    }

    const mapping = this.mappingEntries(stored);
    const outcome = syncOutcomeForMapping(mapping);
    const unmapped = mapping.filter((m) => !m.glAccountId).length;
    const recordsSynced =
      outcome === 'partial'
        ? DEMO_SYNC_RECORD_COUNT - PARTIAL_SYNC_PENALTY
        : DEMO_SYNC_RECORD_COUNT;
    const detail =
      outcome === 'partial'
        ? `${unmapped} categor${unmapped === 1 ? 'y' : 'ies'} not mapped — those transactions were skipped.`
        : undefined;
    stored.lastSyncAt = this.now();
    stored.lastSyncOutcome = outcome;
    this.appendLog(stored, recordsSynced, outcome, detail);
    return {
      outcome: 'ok',
      result: { integration: this.toWire(stored), recordsSynced, outcome },
    };
  }

  /** The provider's sync-log history, newest first (AC-05). */
  getSyncLog(orgId: string, provider: IntegrationProvider): SyncLogEntry[] {
    const stored = this.integrations.get(this.key(orgId, provider));
    if (!stored) return [];
    return [...stored.syncLog].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /** Recover a provider from an `error` connection after re-authorization (AC-04). */
  reconnect(orgId: string, provider: IntegrationProvider): SimpleIntegrationOutcome {
    const stored = this.integrations.get(this.key(orgId, provider));
    if (!stored || stored.status === 'disconnected') return { outcome: 'not_connected' };
    stored.status = 'connected';
    stored.errorMessage = undefined;
    stored.lastSyncAt = this.now();
    stored.lastSyncOutcome = 'success';
    return { outcome: 'ok', integration: this.toWire(stored) };
  }

  /** Disconnect a provider (AC-06). Auto-sync stops; the GL mapping and sync log are preserved. */
  disconnect(orgId: string, provider: IntegrationProvider): SimpleIntegrationOutcome {
    const stored = this.integrations.get(this.key(orgId, provider));
    if (!stored || stored.status === 'disconnected') return { outcome: 'not_connected' };
    stored.status = 'disconnected';
    stored.accountEmail = undefined;
    stored.errorMessage = undefined;
    // GL mapping and sync log deliberately untouched — restored on reconnect (AC-06).
    return { outcome: 'ok', integration: this.toWire(stored) };
  }

  /** Demo/e2e control: push a connected provider into the `error` state so Reconnect is visible (AC-04). */
  forceSyncError(orgId: string, provider: IntegrationProvider): SimpleIntegrationOutcome {
    const stored = this.integrations.get(this.key(orgId, provider));
    if (!stored) return { outcome: 'not_connected' };
    stored.status = 'error';
    stored.lastSyncOutcome = 'failed';
    stored.errorMessage = 'Last sync failed — QuickBooks connection may need to be refreshed.';
    return { outcome: 'ok', integration: this.toWire(stored) };
  }

  private ensureConnected(orgId: string, provider: IntegrationProvider): StoredIntegration | null {
    const stored = this.integrations.get(this.key(orgId, provider));
    return stored && stored.status !== 'disconnected' ? stored : null;
  }

  private mappingEntries(stored: StoredIntegration): GlMappingEntry[] {
    return GL_MAPPING_CATEGORIES.map((category) => {
      const glAccountId = stored.glMapping.get(category.id);
      return {
        categoryId: category.id,
        categoryLabel: category.label,
        ...(glAccountId ? { glAccountId } : {}),
      };
    });
  }

  private appendLog(
    stored: StoredIntegration,
    recordsSynced: number,
    outcome: SyncOutcome,
    detail?: string,
  ): SyncLogEntry {
    this.syncCounter += 1;
    const entry: SyncLogEntry = {
      id: `sync_${this.syncCounter}`,
      timestamp: this.now(),
      recordsSynced,
      outcome,
      ...(detail ? { detail } : {}),
    };
    stored.syncLog.push(entry);
    return entry;
  }

  private toWire(stored: StoredIntegration): Integration {
    return {
      provider: stored.provider,
      name: INTEGRATION_CATALOGUE[stored.provider].name,
      status: stored.status,
      ...(stored.accountEmail ? { accountEmail: stored.accountEmail } : {}),
      ...(stored.lastSyncAt ? { lastSyncAt: stored.lastSyncAt } : {}),
      ...(stored.lastSyncOutcome ? { lastSyncOutcome: stored.lastSyncOutcome } : {}),
      ...(stored.errorMessage ? { errorMessage: stored.errorMessage } : {}),
    };
  }

  private disconnectedWire(provider: IntegrationProvider): Integration {
    return {
      provider,
      name: INTEGRATION_CATALOGUE[provider].name,
      status: 'disconnected',
    };
  }

  private key(orgId: string, provider: IntegrationProvider): string {
    return `${orgId}:${provider}`;
  }
}
