import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { DEMO_USER_PASSWORD, SEED_USERS } from '@clearline/mock-backend/fixtures';
import { resetSection } from '../../dev/beacon/global.beacon';

const account = (email: string) => SEED_USERS.find((user) => user.email === email)!;
const EMPLOYEE = account('employee@clearline.dev');
const CONTROLLER = account('controller@clearline.dev');
const OWNER = account('owner@clearline.dev');

/**
 * Layout-level demo guide for the whole /settings surface (US-CW-033). Registered by SettingsLayout so
 * it's active across every /settings/* route; a leaf section story can register its own config that
 * overrides this while mounted (last-registered wins) and this resurfaces on unmount. It teaches the
 * one thing this surface is about: the role-scoped Profile-vs-Organization split, and that the split
 * is enforced by the API (403), not just hidden in the UI.
 */
export const settingsBeacon: DemoBeaconPageConfig = {
  pageId: 'settings',
  title: 'Settings',
  summary:
    'A role-scoped **/settings** area. Everyone gets the **Profile** group (Personal Info, Security, ' +
    'Notifications); the **Organization** group appears only for a Controller, Admin, or Owner — and ' +
    'every org route is refused by the API too (403), not merely hidden.',
  sections: [
    {
      kind: 'copyable',
      title: 'Switch roles to see the difference',
      items: [
        {
          label: `${EMPLOYEE.displayName} · Employee`,
          value: EMPLOYEE.email,
          hint: 'Profile group only — no Organization group is rendered.',
        },
        {
          label: `${CONTROLLER.displayName} · Controller + Admin`,
          value: CONTROLLER.email,
          hint: 'Adds the Organization group (company, policies, integrations…).',
        },
        {
          label: `${OWNER.displayName} · Owner`,
          value: OWNER.email,
          hint: 'Sees every section, including Admin/Owner-only Billing & Developer.',
        },
        {
          label: 'Password · all roles',
          value: DEMO_USER_PASSWORD,
          hint: 'The same password works for every account above.',
        },
      ],
    },
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'employee-view',
          title: 'See the Employee (Profile-only) view',
          steps: [
            { text: 'Sign in as `employee@clearline.dev`.' },
            {
              text: 'Open Settings from the sidebar — only the **Profile** group appears.',
              navigateTo: '/settings/personal',
            },
            {
              text: 'Deep-link an org route directly — you get an access-denied screen, and the API returns 403.',
              navigateTo: '/settings/billing',
            },
          ],
        },
        {
          id: 'organization-view',
          title: 'See the full Organization view',
          steps: [
            { text: 'Sign in as `owner@clearline.dev`.' },
            {
              text: 'Open Settings — the **Organization** group now renders beneath Profile.',
              navigateTo: '/settings/company',
            },
            {
              text: 'Owner/Admin-only sections like Billing & Plan are now reachable.',
              navigateTo: '/settings/billing',
            },
          ],
        },
      ],
    },
    resetSection,
  ],
};
