import { AnalyticsService } from './analytics.service';

/**
 * The one AnalyticsService the running app's analytics handlers bind to, so a GET summary and a
 * subsequent section read share the same in-memory state and freshness stamp (same rationale as
 * sharedApprovalsService). Not persisted across a full page reload — it resets to the seed, which is
 * fine for a demo dashboard; tests inject their own isolated, fixed-clock instance.
 */
export const sharedAnalyticsService = new AnalyticsService();
