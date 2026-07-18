import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Audit log guide (US-CW-021). Orients a viewer to the immutable, append-only log — the seeded
 * cross-cutting events, the self-referential "your access is logged" behaviour, and the fact that only
 * a Controller can open it at all. Read-only feature, so there are no scenario toggles.
 */
export const auditLogBeacon: DemoBeaconPageConfig = {
  pageId: 'audit',
  title: 'Audit log',
  summary:
    'An **immutable, append-only** record of every financial action — payments, approvals, card-control changes, and role changes — with a **before → after** diff. Only **Controller & Admin** can open it, and **opening it is itself logged**: your access appears as the highlighted top row. Nothing here can edit or delete an entry; corrections are appended as new events.',
  sections: [
    {
      kind: 'entities',
      title: 'Seeded events',
      columns: [
        { key: 'actor', label: 'Actor' },
        { key: 'action', label: 'Action' },
        { key: 'change', label: 'Before → After' },
      ],
      rows: [
        {
          actor: 'M. Okafor',
          action: 'Approved expense exp-4490',
          change: 'Pending L1 → Approved',
        },
        { actor: 'S. Whitman', action: 'Froze card ••5567', change: 'Active → Frozen' },
        {
          actor: 'S. Whitman',
          action: 'Changed role · J. Lin',
          change: 'Finance Manager → Employee',
        },
        {
          actor: 'M. Okafor',
          action: 'Submitted payment pi_8f2a',
          change: '$12,400.00 → Acme Corp',
        },
        { actor: 'S. Whitman', action: 'Viewed audit log', change: 'access recorded' },
      ],
    },
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'self-audit',
          title: 'See your own access recorded',
          steps: [
            {
              text: 'You are signed in as a **Controller** — the only role that can open this view.',
            },
            {
              text: 'The **top row** is *your* "Viewed audit log" event, tinted as your own access — proof that reading the log is itself audited.',
            },
            {
              text: 'Take an action elsewhere (freeze a card, approve an expense, submit a payment), then return — the new event is appended at the top.',
            },
          ],
        },
        {
          id: 'restricted-access',
          title: 'Confirm the access restriction',
          steps: [
            {
              text: 'Open the Dashboard guide and switch role to **Employee** or **Finance Manager**.',
            },
            {
              text: 'The **Audit Log** nav item disappears, and visiting **/audit** directly shows an access-denied surface — the server rejects it with a 403 regardless of the UI.',
            },
            { text: 'Switch back to **Controller** to restore access.' },
          ],
        },
      ],
    },
    resetSection,
  ],
};
