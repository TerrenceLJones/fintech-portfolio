import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Card-issuance guide (Controller-only). Walks a viewer through the design's canonical example — a
 * $2,000 monthly limit restricted to Software + Office Supplies — and calls out that issuance is
 * recorded in the audit log with its limits and restrictions (US-CW-014 AC-01).
 */
export const issueCardBeacon: DemoBeaconPageConfig = {
  pageId: 'cards.issue',
  title: 'Issue a card',
  summary:
    'Issue a virtual card with a monthly limit and merchant-category (MCC) restrictions. Creation is recorded in the audit log with its limits — the card then appears in the wallet and opens its own live feed.',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'issue-example',
          title: 'Issue the design’s example card',
          steps: [
            { text: 'Pick a cardholder — e.g. **Dara Reyes — Design**.' },
            { text: 'Set the **Monthly limit** to **$2,000**.' },
            { text: 'Select the **Software** and **Office Supplies** categories.' },
            {
              text: 'Click **Issue card** — you land on the new card’s live feed, and the issuance is audited with its limit + MCCs.',
            },
          ],
        },
      ],
    },
    {
      kind: 'text',
      title: 'MCC restrictions',
      body: 'Leaving every category off issues an **unrestricted** card. Selecting some restricts the card to those categories — a charge anywhere else is declined with an “MCC restricted” reason (see any card’s feed).',
    },
    resetSection,
  ],
};
