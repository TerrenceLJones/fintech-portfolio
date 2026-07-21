import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Organization Notifications demo guide (US-CW-039). Registered by OrgNotificationsPage so it overrides
 * the layout-level settings guide while mounted. It shows routing org-level alerts to named recipients
 * (immediate save, no footer): adding/removing a budget-alert recipient and setting the approval-queue
 * reminder cadence. Organization-group: only a Controller/Admin/Owner ever sees it (AC-09).
 */
export const orgNotificationsBeacon: DemoBeaconPageConfig = {
  pageId: 'settings.org-notifications',
  title: 'Organization Notifications',
  summary:
    'Direct org-level alerts to named people — a **budget-threshold** recipient list and the ' +
    '**approval-queue** reminder cadence. Every change saves immediately.',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'recipients',
          title: 'Route budget alerts',
          steps: [
            {
              text: 'Under **Budget threshold alerts**, pick a member from **Add a recipient** — e.g. the Finance Manager — and they start receiving 80%/100% alerts (AC-07).',
            },
            {
              text: 'Click the **×** on a recipient chip to stop their budget-threshold emails (AC-07).',
            },
          ],
        },
        {
          id: 'reminders',
          title: 'Set the reminder cadence',
          steps: [
            {
              text: 'Set **Approval-queue reminders** to **Every 24 hours** — approvers with pending items get a daily digest until the queue clears (AC-08).',
            },
          ],
        },
      ],
    },
    resetSection,
  ],
};
