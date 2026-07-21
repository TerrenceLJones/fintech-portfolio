import type {
  ChartOfAccount,
  IntegrationProvider,
  IntegrationStatus,
  SyncOutcome,
} from '@clearline/contracts';
import { SEED_EXPENSE_CATEGORIES } from './expenses.fixture';
import { SEED_ORGANIZATION } from './users.fixture';

/** A seeded provider integration for one org — the starting connection state for the demo. */
export interface SeedIntegration {
  orgId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  accountEmail?: string;
  /** ISO-8601 last-sync timestamp; absent when never synced. */
  lastSyncAt?: string;
  lastSyncOutcome?: SyncOutcome;
  errorMessage?: string;
}

/**
 * The demo org starts with QuickBooks connected (with prior sync activity so the sync log and Partial
 * state are demoable), NetSuite in an `error` state so the Reconnect flow (AC-04) is visible out of the
 * box, and Xero disconnected so the OAuth connect flow (AC-01) can be exercised from a clean card.
 */
export const SEED_INTEGRATIONS: SeedIntegration[] = [
  {
    orgId: SEED_ORGANIZATION.id,
    provider: 'quickbooks',
    status: 'connected',
    accountEmail: 'books@acme.com',
    lastSyncAt: '2026-07-15T02:00:00.000Z',
    lastSyncOutcome: 'success',
  },
  {
    orgId: SEED_ORGANIZATION.id,
    provider: 'xero',
    status: 'disconnected',
  },
  {
    orgId: SEED_ORGANIZATION.id,
    provider: 'netsuite',
    status: 'error',
    accountEmail: 'acme-prod@netsuite.com',
    lastSyncAt: '2026-07-12T02:00:00.000Z',
    lastSyncOutcome: 'failed',
    errorMessage: 'Token expired at last sync (Jul 12). Reconnect to resume auto-sync.',
  },
];

/**
 * The mocked provider chart of accounts a category maps to (AC-02). One shared demo CoA stands in for
 * every provider — the demo models the mapping UX, not each provider's real account taxonomy.
 */
export const SEED_CHART_OF_ACCOUNTS: ChartOfAccount[] = [
  { id: 'coa_6000', name: 'Travel Expense', code: '6000' },
  { id: 'coa_6100', name: 'Meals & Entertainment', code: '6100' },
  { id: 'coa_6200', name: 'Software Subscriptions', code: '6200' },
  { id: 'coa_6300', name: 'Equipment', code: '6300' },
  { id: 'coa_6400', name: 'Office Supplies', code: '6400' },
  { id: 'coa_6900', name: 'General & Administrative', code: '6900' },
];

/**
 * The seeded GL mapping for the pre-connected QuickBooks integration — deliberately leaves one category
 * ("Equipment") unmapped so the amber "Not mapped" flag and the Partial-sync outcome (AC-02/05) are
 * demoable without the tester first having to break a clean mapping. Keyed by expense-category id.
 */
export const SEED_QUICKBOOKS_GL_MAPPING: Record<string, string> = {
  travel: 'coa_6000',
  meals: 'coa_6100',
  software: 'coa_6200',
  office: 'coa_6400',
  // `equipment` intentionally omitted — starts "Not mapped".
};

/** The Clearline expense categories every GL-mapping table lists on its left-hand side (AC-02). */
export const GL_MAPPING_CATEGORIES = SEED_EXPENSE_CATEGORIES.map((category) => ({
  id: category.id,
  label: category.label,
}));

/** The record count a successful demo sync reports — matches the AC-03 toast copy ("47 transactions"). */
export const DEMO_SYNC_RECORD_COUNT = 47;
