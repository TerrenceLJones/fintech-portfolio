import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';

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
            { text: 'Use any new email, e.g. `tester+1@clearline.dev`.' },
            { text: 'Pick a strong password, e.g. `Correct-Horse-Battery-1`.' },
            {
              text: 'You enter the onboarding wizard at the business-info step.',
              navigateTo: '/onboarding/business',
            },
          ],
        },
      ],
    },
  ],
};
