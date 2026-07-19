import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Notifications demo guide (US-CW-034). Registered by NotificationsPage; overrides the layout-level
 * settings guide while mounted. It teaches the two behaviors this page is about: per-row auto-save
 * (no Save button) with the frequency selector appearing only when a channel is on, and the bulk
 * Notification Summary that skips security alerts and yields to per-row overrides.
 */
export const notificationsBeacon: DemoBeaconPageConfig = {
  pageId: 'settings.notifications',
  title: 'Notifications',
  summary:
    'Independent **Email** and **In-App** toggles per notification, each **saved instantly** (no Save ' +
    'button). The **frequency** selector appears only when a channel is on; turn both off and you see ' +
    '"You won\'t be notified". A bulk **Notification Summary** sets one frequency across every row that ' +
    'supports it — **Security alerts** are never touched.',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'per-row',
          title: 'Channels & frequency auto-save',
          steps: [
            {
              text: 'Toggle **Email** or **In-App** on a row — it saves immediately with a subtle confirmation.',
            },
            {
              text: 'With a channel on, change **Frequency** (Instant / Daily / Weekly) — also saved instantly.',
            },
            {
              text: 'Turn **both** channels off — the frequency selector is replaced by "You won\'t be notified".',
            },
          ],
        },
        {
          id: 'summary',
          title: 'Bulk Notification Summary',
          steps: [
            { text: 'Pick a frequency in **Notification Summary** and click **Apply**.' },
            {
              text: 'Every frequency-supporting row adopts it; **Security alerts** stay unchanged.',
            },
            { text: 'Override a single row afterward — your override wins over the bulk value.' },
          ],
        },
      ],
    },
    resetSection,
  ],
};
