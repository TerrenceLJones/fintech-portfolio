import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { DEMO_USER_PASSWORD } from '@clearline/mock-backend/fixtures';
import { DEMO_EMAIL, loadControls } from '../dev/beacon/shared';

/** Sign-in guide: the seeded credentials and the auth-outage scenario. */
export const loginBeacon: DemoBeaconPageConfig = {
  pageId: 'login',
  title: 'Sign in',
  summary: 'The demo account is pre-seeded and already onboarded, so you land on the dashboard.',
  sections: [
    {
      kind: 'copyable',
      title: 'Demo credentials',
      items: [
        {
          label: 'Email',
          value: DEMO_EMAIL,
          hint: 'Marcus Okafor — a Finance Manager ($10,000 limit).',
        },
        { label: 'Password', value: DEMO_USER_PASSWORD },
      ],
    },
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'sign-in',
          title: 'Sign in',
          steps: [
            { text: 'Copy the email and password above into the form.' },
            { text: 'Submit — you land on the dashboard.' },
          ],
        },
      ],
    },
    {
      kind: 'toggles',
      title: 'Scenarios',
      toggles: [
        {
          id: 'auth-outage',
          label: 'Simulate auth outage',
          description:
            'While on, every sign-in attempt returns a 500 so you can see the retry/backoff UI. Turn it off to sign in normally.',
          get: async () => {
            const { isLoginFailureArmed } = await loadControls();
            return isLoginFailureArmed();
          },
          set: async (on) => {
            const { setLoginFailure } = await loadControls();
            setLoginFailure(on);
          },
        },
      ],
    },
  ],
};
