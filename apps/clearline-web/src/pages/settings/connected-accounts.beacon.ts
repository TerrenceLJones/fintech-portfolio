import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { MICRO_DEPOSIT_AMOUNTS_MINOR_UNITS } from '@clearline/mock-backend/fixtures';
import { resetSection } from '../../dev/beacon/global.beacon';

const [firstCents, secondCents] = MICRO_DEPOSIT_AMOUNTS_MINOR_UNITS;
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Connected Accounts demo guide (US-CW-038). Registered by ConnectedAccountsPage so it overrides the
 * layout-level settings guide while mounted. It walks the three connection paths — Plaid (lands
 * verified), manual micro-deposit verification (with the fixed demo amounts revealed here), and
 * reconnecting the seeded reconnect-required account — plus removal, which names the account and never
 * touches in-flight payments. Organization-group: only a Controller, Admin, or Owner ever sees it (AC-09).
 */
export const connectedAccountsBeacon: DemoBeaconPageConfig = {
  pageId: 'settings.connected-accounts',
  title: 'Connected Accounts',
  summary:
    'Connect funding bank accounts via **Plaid** or **manual micro-deposits**, **reconnect** a Plaid ' +
    'account that needs re-auth, and **remove** one — removal never disturbs an in-flight payment.',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'plaid',
          title: 'Connect via Plaid',
          steps: [
            {
              text: '**Connect account → Connect via Plaid** — it lands **Connected** instantly (AC-04).',
            },
          ],
        },
        {
          id: 'manual',
          title: 'Manual micro-deposit verification',
          steps: [
            {
              text: '**Connect account → Enter account details manually**, use a **9-digit** routing number, and send micro-deposits (AC-05).',
            },
            {
              text: `On the pending row, **Verify** with the demo amounts **${dollars(firstCents!)}** and **${dollars(secondCents!)}** — three wrong tries locks it (AC-06).`,
            },
          ],
        },
        {
          id: 'reconnect',
          title: 'Reconnect & remove',
          steps: [
            {
              text: 'The **Novo Business** account shows **Reconnect needed** — click **Reconnect** to restore it (AC-08).',
            },
            {
              text: '**Remove** any account — the confirmation names it and spells out the consequence (AC-07).',
            },
          ],
        },
      ],
    },
    resetSection,
  ],
};
