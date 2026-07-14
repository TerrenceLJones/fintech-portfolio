import type { Money } from '@clearline/contracts';
import type { DemoBeaconSection } from '@clearline/demo-beacon';
import { formatMoneyValue } from '@clearline/ui';
import { DEMO_USER_PASSWORD, SEED_USERS } from '@clearline/mock-backend/fixtures';

/** The seeded demo account every scenario acts on. */
export const DEMO_EMAIL = SEED_USERS[0]!.email;

/**
 * The throwaway email the sign-up and email-verification guides tell viewers to use, kept in one
 * place so the flow copy and the one-click verify action below always agree on the same account.
 */
export const EXAMPLE_SIGNUP_EMAIL = 'tester+1@clearline.dev';

/**
 * Format a minor-units Money value for display in beacon config, via the same currency-aware
 * formatter the app now uses (US-CW-008 money-utils refactor).
 */
export function money(m: Money): string {
  return formatMoneyValue(m);
}

/**
 * Lazily load the mock-backend browser entry (the `simulate*` controls). A dynamic import so the
 * MSW/worker code stays in its own chunk and is only fetched when a scenario button runs.
 */
export const loadControls = () => import('@clearline/mock-backend/browser');

/**
 * A one-click stand-in for the verification email the demo can't actually send. New sign-ups land on
 * a "verify your email to continue" wall, but there's no inbox here — so this mints a fresh
 * verification token for {@link EXAMPLE_SIGNUP_EMAIL} and opens the link, which verifies the address,
 * signs you in, and funnels you into the KYB onboarding wizard. Reused by both the login and sign-up
 * beacons since either page can be where a viewer hits the wall.
 */
export const verifyEmailSection: DemoBeaconSection = {
  kind: 'actions',
  title: 'Email verification',
  actions: [
    {
      id: 'verify-email',
      label: 'Get verification link & continue',
      description: `No real inbox in the demo — this mints the link for \`${EXAMPLE_SIGNUP_EMAIL}\`, opens it, and drops you into onboarding.`,
      run: async () => {
        const { issueVerificationTokenForE2E } = await loadControls();
        const token = await issueVerificationTokenForE2E(EXAMPLE_SIGNUP_EMAIL, DEMO_USER_PASSWORD);
        if (token == null) {
          throw new Error(`${EXAMPLE_SIGNUP_EMAIL} is already verified — just sign in.`);
        }
        window.location.assign(`/verify?token=${encodeURIComponent(token)}`);
      },
    },
  ],
};
