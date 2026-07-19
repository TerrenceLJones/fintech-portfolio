import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { resetSection } from '../../dev/beacon/global.beacon';
import { DEMO_EMAIL, loadControls } from '../../dev/beacon/shared';

/** The demo address the email-change actions move the seeded account to. */
const DEMO_NEW_EMAIL = 'marcus.new@clearline.dev';

/**
 * Personal Info demo guide (US-CW-034). Registered by PersonalInfoPage so it overrides the
 * layout-level settings guide while mounted (last-registered wins) and the settings guide resurfaces
 * on unmount. It teaches the three surfaces this page establishes for the epic: the unsaved-changes
 * footer, the avatar crop/remove flow, and — because the demo has no inbox — a one-click stand-in for
 * the email-change confirmation link (valid and expired), mirroring the verify-email guide.
 */
export const personalInfoBeacon: DemoBeaconPageConfig = {
  pageId: 'settings.personal',
  title: 'Personal Info',
  summary:
    'Edit your identity behind a **sticky unsaved-changes footer** (Save/Discard, with a leave ' +
    'guard), crop a new **avatar** that propagates to the sidebar, and change your **login email** ' +
    'through a verified link — the old email keeps working until you confirm the new one.',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'unsaved-footer',
          title: 'The unsaved-changes footer',
          steps: [
            {
              text: 'Edit **Full name**, **Phone**, or **Job title** — a sticky Save/Discard bar appears.',
            },
            {
              text: '**Discard** reverts every field; **Save changes** persists and shows a "Profile updated" toast.',
            },
            { text: 'Try navigating away with unsaved edits — you are warned before losing them.' },
          ],
        },
        {
          id: 'avatar',
          title: 'Avatar crop & remove',
          steps: [
            { text: 'Click **Upload photo** and pick a JPG/PNG/WebP — a crop dialog opens.' },
            {
              text: 'Confirm the crop — the new avatar appears here **and** in the sidebar identity chip.',
            },
            { text: '**Remove photo** confirms first, then falls back to your initials.' },
          ],
        },
      ],
    },
    {
      kind: 'actions',
      title: 'Email change (no inbox in the demo)',
      actions: [
        {
          id: 'email-change-link',
          label: 'Get a valid confirmation link',
          description: `Mints the confirmation link for a change to \`${DEMO_NEW_EMAIL}\` and opens it, swapping your login email. Reset demo state to restore \`${DEMO_EMAIL}\`.`,
          run: async () => {
            const { issueEmailChangeTokenForE2E } = await loadControls();
            const token = await issueEmailChangeTokenForE2E(DEMO_EMAIL, DEMO_NEW_EMAIL);
            if (token == null)
              throw new Error('Email change was rejected — try resetting demo state.');
            window.location.assign(`/email-change/confirm?token=${encodeURIComponent(token)}`);
          },
        },
        {
          id: 'email-change-expired',
          label: 'Get an already-expired link',
          description:
            'Opens a link past its 24-hour TTL, so you see the "This link has expired" screen (AC-04).',
          run: async () => {
            const { issueExpiredEmailChangeTokenForE2E } = await loadControls();
            const token = await issueExpiredEmailChangeTokenForE2E(DEMO_EMAIL, DEMO_NEW_EMAIL);
            if (token == null)
              throw new Error('Email change was rejected — try resetting demo state.');
            window.location.assign(`/email-change/confirm?token=${encodeURIComponent(token)}`);
          },
        },
      ],
    },
    resetSection,
  ],
};
