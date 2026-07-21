import type { ConnectionMethod, ConnectionStatus } from '@clearline/contracts';
import { SEED_ORGANIZATION } from './users.fixture';

/** A seeded connected bank account. The full number is never stored — only its last four. */
export interface SeedConnectedAccount {
  id: string;
  /** The org that owns this account — every query and mutation is scoped to it (owning-org check). */
  orgId: string;
  institutionName: string;
  last4: string;
  method: ConnectionMethod;
  status: ConnectionStatus;
}

/**
 * The demo org starts with three funding accounts (US-CW-038): a Plaid account and a manually-verified
 * account both connected, plus a Plaid account already in `reconnect_required` (ITEM_LOGIN_REQUIRED) so
 * the reconnect flow (AC-08) is demonstrable out of the box without any runtime toggling. New
 * manual-connection + micro-deposit verification flows (AC-05/06) are exercised at runtime.
 */
export const SEED_CONNECTED_ACCOUNTS: SeedConnectedAccount[] = [
  {
    id: 'acct_chase',
    orgId: SEED_ORGANIZATION.id,
    institutionName: 'Chase Business Complete',
    last4: '8291',
    method: 'plaid',
    status: 'connected',
  },
  {
    id: 'acct_svb',
    orgId: SEED_ORGANIZATION.id,
    institutionName: 'Silicon Valley Bank',
    last4: '3355',
    method: 'manual',
    status: 'connected',
  },
  {
    id: 'acct_novo',
    orgId: SEED_ORGANIZATION.id,
    institutionName: 'Novo Business',
    last4: '6120',
    method: 'plaid',
    status: 'reconnect_required',
  },
];

/**
 * The two micro-deposit amounts (minor units) every manually-connected account must be verified with
 * in the demo (US-CW-038 AC-05/06): $0.18 and $0.42. Fixed and deterministic so a tester (guided by the
 * demo beacon) and the test suite can both enter the correct amounts; a real integration would randomise
 * these per account.
 */
export const MICRO_DEPOSIT_AMOUNTS_MINOR_UNITS: readonly [number, number] = [18, 42];

/** A manual account gets three attempts to enter the micro-deposit amounts before it locks (AC-06). */
export const MICRO_DEPOSIT_MAX_ATTEMPTS = 3;
