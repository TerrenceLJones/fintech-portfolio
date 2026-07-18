import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { loadControls } from '../../dev/beacon/shared';

const DEMO_INVITE_EMAIL = 'newteammate@clearline.dev';

/**
 * Invite-acceptance guide (US-CW-031 AC-02/AC-03). Explains that a brand-new invitee sets a password
 * and lands straight on their role dashboard — never the KYB onboarding wizard, which is a
 * per-organization step the Owner already completed — and lets a viewer mint fresh or expired links.
 */
export const inviteAcceptBeacon: DemoBeaconPageConfig = {
  pageId: 'invite-accept',
  title: 'Accept invite',
  summary:
    'A brand-new teammate sets a password here and is dropped **straight onto their role dashboard** — never business onboarding (that’s a one-time, per-organization step the Owner already did). The link is **single-use** and valid for **7 days**.',
  sections: [
    {
      kind: 'text',
      title: 'How this works',
      body: 'The `?token=` in the URL is a **single-use, hashed, 7-day** invite token — the same shape as sign-up verification and password-reset tokens. An **expired or already-used** link grants no membership and shows the expired screen.',
    },
    {
      kind: 'actions',
      title: 'Get a link',
      actions: [
        {
          id: 'fresh-invite',
          label: 'Mint a fresh invite link',
          description: `Issues a valid invite for \`${DEMO_INVITE_EMAIL}\` and opens it here so you can set a password and join.`,
          run: async () => {
            const { issueInviteTokenForE2E } = await loadControls();
            const token = await issueInviteTokenForE2E(DEMO_INVITE_EMAIL);
            if (token == null) {
              throw new Error(
                `An invite to ${DEMO_INVITE_EMAIL} is already pending — Reset demo state to retry.`,
              );
            }
            window.location.assign(`/invite?token=${encodeURIComponent(token)}`);
          },
        },
        {
          id: 'expired-invite',
          label: 'Mint an expired invite link',
          description:
            'Issues an invite backdated past the 7-day window so you can see the expired screen.',
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
  ],
};
