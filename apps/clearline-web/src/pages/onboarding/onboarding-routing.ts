import type { OnboardingOverallStatus } from '@clearline/contracts';

/** The three route areas a signed-in user can belong to, keyed off their server onboarding status. */
export type OnboardingArea = 'wizard' | 'status' | 'app';

/**
 * Maps an onboarding status to the area a user with that status belongs in — the single source of
 * truth the onboarding route guards share (US-CW-004 AC-09..AC-12). It is a *default landing*: it's
 * where a guard redirects a user who is out of place, e.g. an approved user who reopened a wizard
 * URL lands on the app, and an in_progress user who opened the status page lands back in the wizard.
 *
 * `under_review` maps to `status` (its post-submission landing) even though such a user is *also*
 * admitted to the app — that admission is a separate rule, `canAccessApp`, not a change of home.
 */
export function onboardingDestination(status: OnboardingOverallStatus): OnboardingArea {
  switch (status) {
    case 'in_progress':
      return 'wizard';
    case 'under_review':
    case 'documents_blocked':
      return 'status';
    case 'approved':
      return 'app';
  }
}

/**
 * Whether the main (non-onboarding) app is reachable for this status. `approved` unlocks everything;
 * `under_review` is admitted too so a pending compliance review never blocks non-financial areas of
 * the product (US-CW-005 AC-05). `in_progress` (not yet submitted) and `documents_blocked` (hard
 * stop, contact support) are not.
 */
export function canAccessApp(status: OnboardingOverallStatus): boolean {
  return status === 'approved' || status === 'under_review';
}
