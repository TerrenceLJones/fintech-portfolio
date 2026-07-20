import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Security demo guide (US-CW-035). Registered by SecurityPage so it overrides the layout-level settings
 * guide while mounted. It walks the four self-service surfaces: password change (with the strength gate
 * and no forced sign-out), the client-side-QR 2FA setup with one-time backup codes, active-session
 * revocation with the current session protected, and trusted-device removal. The demo account is seeded
 * with three sessions and one trusted device so every flow is reachable without setup.
 */
export const securityBeacon: DemoBeaconPageConfig = {
  pageId: 'settings.security',
  title: 'Security',
  summary:
    'Change your **password** (gated on a strength meter; other sessions are **not** signed out), set ' +
    'up **authenticator-app 2FA** — the QR is rendered in your browser so the secret never leaves the ' +
    'device, and backup codes are shown **once** — review and revoke **active sessions** (your current ' +
    'one is protected), and remove **trusted devices**.',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'password',
          title: 'Change your password',
          steps: [
            { text: 'Enter your current password (`Correct-Horse-Battery-1`), then a new one.' },
            {
              text: 'The **strength meter** gates the button — it stays disabled until the new password is Strong (12+ chars, mixed case, number, symbol).',
            },
            {
              text: 'A wrong current password shows "Incorrect password" and clears just that field; other sessions stay signed in.',
            },
          ],
        },
        {
          id: 'twofa',
          title: 'Enable authenticator-app 2FA',
          steps: [
            {
              text: 'Click **Enable authenticator app** — a QR renders locally (no external request).',
            },
            {
              text: 'Enter the current 6-digit code from your authenticator; a wrong code keeps you on the verify step.',
            },
            {
              text: 'On success, **10 backup codes** appear once — copy or print them; they are never shown again.',
            },
          ],
        },
        {
          id: 'sessions',
          title: 'Sessions & trusted devices',
          steps: [
            {
              text: 'Under **Active sessions**, your current device is badged "This device" and its sign-out is disabled.',
            },
            {
              text: '**Sign out this device** on another session confirms first, then removes it.',
            },
            { text: 'Remove a **trusted device** so its next sign-in requires 2FA again.' },
          ],
        },
      ],
    },
    resetSection,
  ],
};
