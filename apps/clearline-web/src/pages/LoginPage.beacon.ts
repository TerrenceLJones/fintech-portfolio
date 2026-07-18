import type { Role } from '@clearline/contracts';
import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { DEMO_USER_PASSWORD, EXPENSE_CURRENCY, SEED_USERS } from '@clearline/mock-backend/fixtures';
import { formatMoneyValue } from '@clearline/ui';
import { EXAMPLE_SIGNUP_EMAIL, loadControls } from '../dev/beacon/shared';
import { resetSection } from '../dev/beacon/global.beacon';

const ROLE_LABEL: Record<Role, string> = {
  employee: 'Employee',
  finance_manager: 'Finance Manager',
  controller: 'Controller',
};

/** Ascending access level, so the credentials list reads Employee → Finance Manager → Controller. */
const ROLE_ACCESS_ORDER: Record<Role, number> = {
  employee: 0,
  finance_manager: 1,
  controller: 2,
};

const SEED_USERS_BY_ACCESS = [...SEED_USERS].sort(
  (a, b) => ROLE_ACCESS_ORDER[a.role] - ROLE_ACCESS_ORDER[b.role],
);

/** Where each role lands after signing in (US-CW-001), surfaced in the credential hint. */
const ROLE_HOME: Record<Role, string> = {
  employee: 'My Expenses',
  finance_manager: 'Spend dashboard',
  controller: 'Spend dashboard',
};

/** The row hint: approval authority (for approvers) and the role-based home the account lands on. */
function landingHint(user: (typeof SEED_USERS)[number]): string {
  const authority =
    user.role === 'employee'
      ? ''
      : user.approvalLimit === null
        ? 'unlimited · '
        : `${formatMoneyValue({ amountMinorUnits: user.approvalLimit, currency: EXPENSE_CURRENCY })} limit · `;
  return `${authority}lands on ${ROLE_HOME[user.role]}.`;
}

/**
 * One copyable section per role, ordered by access level, so the role name renders as the section
 * heading above the account's name, email, and where it lands. All share the password below.
 */
/** Tag the heading with the orthogonal team-administration authority (US-CW-006 AC-08): the Owner and
 * the (non-owner) Admin are the accounts that reach the Team surface, and both share the Controller
 * tier here — so the tag also disambiguates the otherwise-identical Controller headings. */
function credentialHeading(user: (typeof SEED_USERS)[number]): string {
  if (user.isOwner) return `${ROLE_LABEL[user.role]} (Owner)`;
  if (user.isAdmin) return `${ROLE_LABEL[user.role]} · Admin`;
  return ROLE_LABEL[user.role];
}

const credentialSections = SEED_USERS_BY_ACCESS.map((user) => ({
  kind: 'copyable' as const,
  title: credentialHeading(user),
  items: [{ label: user.displayName, value: user.email, hint: landingHint(user) }],
}));

/** Sign-in guide: one credential per role (all share the same password) and the auth-outage scenario. */
export const loginBeacon: DemoBeaconPageConfig = {
  pageId: 'login',
  title: 'Sign in',
  summary:
    'Pre-seeded, already-onboarded accounts — one per role. They all share the same password; pick an email to tour that role and its role-based home.',
  sections: [
    ...credentialSections,
    {
      kind: 'copyable',
      title: 'Password · all roles',
      items: [
        {
          label: 'Password',
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
          id: 'sign-in-role',
          title: 'Sign in as any role',
          steps: [
            { text: 'Copy one of the role emails and the shared password into the form.' },
            {
              text: 'Submit — an **Employee** lands on **My Expenses**; a **Finance Manager** or **Controller** lands on the **Spend dashboard**.',
            },
            {
              text: 'Note the **left sidebar**: only your role-scoped sections are stacked in the rail, and the footer pins your identity — avatar, name, role, and approval limit (e.g. **$10k limit**, **Unlimited**, or nothing for an Employee).',
            },
            {
              text: 'Sign out and repeat with a different role to compare the shells — nav items and the footer authority change with the role.',
            },
          ],
        },
        {
          id: 'see-onboarding',
          title: 'See the KYB onboarding flow',
          steps: [
            {
              text: 'The seeded accounts skip onboarding — start a fresh sign-up instead.',
              navigateTo: '/signup',
            },
            { text: `Use \`${EXAMPLE_SIGNUP_EMAIL}\` and any strong password.` },
            {
              text: 'Hit the "verify your email" wall? Use **Get verification link & continue** in the sign-up guide.',
            },
            { text: 'You land in the KYB wizard at the business-info step.' },
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
    resetSection,
  ],
};
