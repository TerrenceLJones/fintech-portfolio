import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { DEMO_USER_PASSWORD } from '@clearline/mock-backend/fixtures';
import { EXAMPLE_SIGNUP_EMAIL, verifyEmailSection } from '../dev/beacon/shared';

/** Sign-up guide: how to start a fresh KYB onboarding run. */
export const signUpBeacon: DemoBeaconPageConfig = {
  pageId: 'signup',
  title: 'Create an account',
  summary: 'A fresh sign-up starts a new KYB onboarding flow (the demo account skips it).',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'sign-up',
          title: 'Sign up as a new business',
          steps: [
            { text: `Use any new email, e.g. \`${EXAMPLE_SIGNUP_EMAIL}\`.` },
            { text: `Pick a strong password, e.g. \`${DEMO_USER_PASSWORD}\`.` },
            {
              text: 'Submit — the demo can’t send a real email, so use the button below to verify.',
            },
            {
              text: 'Verifying signs you in and opens the KYB wizard at the business-info step.',
            },
          ],
        },
      ],
    },
    verifyEmailSection,
  ],
};
