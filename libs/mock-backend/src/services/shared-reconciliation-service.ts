import { ReconciliationService } from './reconciliation.service';

/**
 * The one ReconciliationService the running app's reconciliation handlers bind to, so a GET exceptions
 * and a subsequent confirm/split act on the same in-memory queue (same rationale as
 * sharedAnalyticsService). Not persisted across a full page reload — it resets to the seed, which is
 * fine for a demo; tests inject their own isolated, fixed-clock instance.
 */
export const sharedReconciliationService = new ReconciliationService();
