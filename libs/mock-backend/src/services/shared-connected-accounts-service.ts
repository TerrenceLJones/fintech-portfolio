import { ConnectedAccountsService } from './connected-accounts.service';

/**
 * The one ConnectedAccountsService the running app's connected-accounts handlers bind to, so a GET list
 * and a subsequent connect/verify/remove act on the same in-memory state (same rationale as
 * sharedReconciliationService). Not persisted across a full page reload — it resets to the seed, which
 * is fine for a demo; tests construct their own isolated instance.
 */
export const sharedConnectedAccountsService = new ConnectedAccountsService();
