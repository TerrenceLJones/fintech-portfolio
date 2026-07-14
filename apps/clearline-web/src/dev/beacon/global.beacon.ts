import type { ActionsSection, DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { DEMO_USER_PASSWORD } from '@clearline/mock-backend/fixtures';
import { DEMO_EMAIL } from './shared';
import { resetDemoState } from '../reset-demo-state';

/**
 * The app-wide "Reset demo data" action, gated behind a confirm because it discards a tester's
 * in-progress work. Shared into the pages a tester is most likely to reset from.
 */
export const resetSection: ActionsSection = {
  kind: 'actions',
  title: 'Demo controls',
  actions: [
    {
      id: 'reset',
      label: 'Reset demo data',
      description: 'Clears role changes, payments, and onboarding progress back to the seed.',
      variant: 'destructive',
      confirm: 'This discards in-progress work.',
      run: resetDemoState,
    },
  ],
};

/**
 * Shown when no page has registered its own guide (e.g. a route we haven't documented). Orients a
 * first-time viewer and hands them the demo login.
 */
export const globalBeacon: DemoBeaconPageConfig = {
  pageId: 'global.fallback',
  title: 'Clearline demo',
  summary:
    'A B2B spend-management demo running entirely on a mock backend — no real API. Sign in with the seeded account and explore.',
  sections: [
    {
      kind: 'copyable',
      title: 'Demo login',
      items: [
        { label: 'Email', value: DEMO_EMAIL },
        { label: 'Password', value: DEMO_USER_PASSWORD },
      ],
    },
    {
      kind: 'text',
      title: 'Tip',
      body: 'Open this guide on any page — it changes to show what **that** page supports.',
    },
    resetSection,
  ],
};
