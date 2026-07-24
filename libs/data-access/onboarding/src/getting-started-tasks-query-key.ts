/**
 * Shared query key for the getting-started read model (EPIC-CW-023). Distinct from the KYB
 * ONBOARDING_STATUS_QUERY_KEY: this tracks the in-app getting-started task completion, which the
 * financial-flow mutations invalidate so the launcher progress refetches after an action completes.
 */
export const GETTING_STARTED_TASKS_QUERY_KEY = ['onboarding-tasks'];
