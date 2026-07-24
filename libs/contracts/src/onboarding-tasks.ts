/**
 * The getting-started (in-app) onboarding layer (EPIC-CW-023) — distinct from the KYB business
 * onboarding in `onboarding.ts`. These are the wire types shared between the client task catalogue
 * (which maps each id to a destination and a completion trigger) and the mock backend (which records
 * completion against these ids as the underlying domain events fire).
 */

/** Stable identifiers for the role-scoped getting-started tasks. */
export type OnboardingTaskId =
  | 'submit-expense'
  | 'see-cards'
  | 'clear-approval'
  | 'read-dashboard'
  | 'send-payment'
  | 'reconcile-transactions'
  | 'issue-card'
  | 'set-budget'
  | 'review-audit'
  | 'invite-team';

/**
 * The per-user getting-started read model (US-CW-044 AC-05 / US-CW-047). `completed` is the set of
 * task ids whose domain action this user has performed (observed server-side, never self-reported);
 * `milestoneShown` guards the once-per-user signature celebration (US-CW-047 AC-03).
 */
export interface OnboardingTasksResponse {
  completed: OnboardingTaskId[];
  milestoneShown: boolean;
}
