import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Card wallet guide. The cards are already on the page, so the Beacon orients a viewer to what the
 * wallet encodes — the derived remaining limit and the icon+text status badges — and points to the
 * two things it doesn't spell out: issuance is Controller-only, and each card opens a live feed.
 */
export const cardWalletBeacon: DemoBeaconPageConfig = {
  pageId: 'cards.wallet',
  title: 'Card wallet',
  summary:
    'Every virtual card shows a **derived** remaining limit (monthly limit minus authorized spend — never stored) and a status badge that reads through **icon + text**, not colour alone.',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'open-card',
          title: 'Open a card’s live feed',
          steps: [
            { text: 'Click any card tile to open its detail view.' },
            {
              text: 'Watch the **live transaction feed** stream authorizations in and move the derived remaining limit.',
            },
          ],
        },
        {
          id: 'issue',
          title: 'Issue a new card (Controller only)',
          steps: [
            {
              text: 'Sign in as the **Controller** to see **+ Issue card** — Employees and Finance Managers can view the wallet but not issue.',
            },
            {
              text: 'Click **+ Issue card** to set a monthly limit and merchant-category restrictions.',
            },
          ],
        },
      ],
    },
    {
      kind: 'text',
      title: 'Reading the wallet',
      body: 'A green **Active** check and a neutral **Frozen** snowflake both pair a glyph with a label — a frozen card is never signalled by colour alone. The subtitle counts the wallet as “N active · M frozen”.',
    },
    resetSection,
  ],
};
