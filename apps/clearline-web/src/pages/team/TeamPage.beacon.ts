import type { DemoBeaconPageConfig, EntityRow } from '@clearline/demo-beacon';
import { SEED_ORGANIZATION, SEED_USERS } from '@clearline/mock-backend/fixtures';
import { loadControls } from '../../dev/beacon/shared';
import { resetSection } from '../../dev/beacon/global.beacon';

const ROLE_LABEL: Record<string, string> = {
  employee: 'Employee',
  finance_manager: 'Finance Manager',
  controller: 'Controller',
};

/** The seeded org's roster, as the Team page shows it — Owner first, then by role. */
const rows: EntityRow[] = SEED_USERS.filter((user) => user.orgId === SEED_ORGANIZATION.id).map(
  (user) => ({
    member: user.displayName,
    email: user.email,
    role: user.isOwner
      ? `${ROLE_LABEL[user.role]} (Owner)`
      : `${ROLE_LABEL[user.role]}${user.isAdmin ? ' · Admin' : ''}`,
  }),
);

/** A throwaway invitee the "get an invite link" actions mint for — never a real address. */
const DEMO_INVITE_EMAIL = 'newteammate@clearline.dev';

/**
 * Team-management guide (US-CW-031). Orients a viewer to the invite-only membership model — only an
 * Owner or Admin reaches this surface, and the Owner is a protected singleton — and hands them the
 * levers to walk the invite → accept → dashboard flow the demo can't email a real link for.
 */
export const teamBeacon: DemoBeaconPageConfig = {
  pageId: 'team',
  title: 'Team',
  summary:
    'Invite-only membership: a teammate can **only** join via an invite from an **Owner or Admin** — never self-service (Ramp/Brex/Mercury model). The **Owner** is a protected singleton — it can’t be removed or demoted. Every role change and removal is written to the **audit log**. Sign in as `owner@clearline.dev` to reach this page.',
  sections: [
    {
      kind: 'entities',
      title: 'Seeded roster',
      columns: [
        { key: 'member', label: 'Member' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
      ],
      rows,
    },
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'invite',
          title: 'Invite a teammate',
          steps: [
            {
              text: 'Press **Invite teammate**, enter a work email, pick a role, optionally grant **Admin**.',
            },
            {
              text: 'The confirmation is **enumeration-safe** — identical whether or not that email already has an account — and the new invite shows as **Pending** in the roster.',
            },
            {
              text: 'Use **Get an invite link** below to walk the acceptance flow the demo can’t email.',
            },
          ],
        },
        {
          id: 'role',
          title: 'Change a member’s role',
          steps: [
            { text: 'Press **Change role** on any non-Owner member and pick a new tier.' },
            {
              text: 'It takes effect on their next request and is written to the **audit log** (prior → new role).',
            },
          ],
        },
        {
          id: 'remove',
          title: 'Remove a member',
          steps: [
            { text: 'Press the **remove** (×) action on a non-Owner member and confirm.' },
            {
              text: 'Their session is invalidated on their next request. The **Owner** is never offered a remove action.',
            },
          ],
        },
        {
          id: 'resend-revoke',
          title: 'Resend or revoke a pending invite',
          steps: [
            {
              text: 'On a **Pending** row, press **Resend** to issue a fresh link — it restarts the 7-day window and **invalidates the old link**.',
            },
            {
              text: 'Or press the **revoke** (×) action and confirm to cancel it — the outstanding link stops working immediately and the invite drops off the roster.',
            },
            {
              text: 'Both are written to the **audit log**. Use **Invite a teammate** above first if there’s no pending invite to act on.',
            },
          ],
        },
      ],
    },
    {
      kind: 'actions',
      title: 'Scenarios',
      actions: [
        {
          id: 'invite-link',
          label: 'Get an invite link & open it',
          description: `Mints a real invite for \`${DEMO_INVITE_EMAIL}\` and opens the acceptance page, standing in for the emailed link. Set a password there to land straight on the dashboard — no onboarding.`,
          run: async () => {
            const { issueInviteTokenForE2E } = await loadControls();
            const token = await issueInviteTokenForE2E(DEMO_INVITE_EMAIL);
            if (token == null) {
              throw new Error(
                `An invite to ${DEMO_INVITE_EMAIL} is already pending — check the roster.`,
              );
            }
            window.location.assign(`/invite?token=${encodeURIComponent(token)}`);
          },
        },
        {
          id: 'expired-invite-link',
          label: 'Get an expired invite link',
          description:
            'Mints an invite backdated past the 7-day window and opens it, so you can see the “This invite has expired” screen — no membership granted (AC-03).',
          run: async () => {
            const { issueExpiredInviteTokenForE2E } = await loadControls();
            const token = await issueExpiredInviteTokenForE2E('expired-invitee@clearline.dev');
            if (token == null) {
              throw new Error('Could not mint an expired invite — try Reset demo state.');
            }
            window.location.assign(`/invite?token=${encodeURIComponent(token)}`);
          },
        },
      ],
    },
    resetSection,
  ],
};
