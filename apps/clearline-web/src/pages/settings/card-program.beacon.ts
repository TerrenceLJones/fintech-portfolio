import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Card Program demo guide (US-CW-038). Registered by CardProgramPage so it overrides the layout-level
 * settings guide while mounted. It teaches that the default limits, MCC restrictions, and issuance
 * policy set here seed newly issued cards (AC-01) — existing cards are untouched — and that the MCC list
 * is searchable by name or numeric code (AC-02). Organization-group: it only renders for a Controller,
 * Admin, or Owner; the API refuses everyone else (AC-09).
 */
export const cardProgramBeacon: DemoBeaconPageConfig = {
  pageId: 'settings.card-program',
  title: 'Card Program',
  summary:
    'Set the **default limits**, **merchant-category restrictions**, and **who can request a card**. ' +
    'These seed every **newly issued** card — existing cards keep their own limits.',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'defaults',
          title: 'Change the default limits',
          steps: [
            {
              text: 'Set a **default monthly** and **per-transaction** limit and **Save changes**.',
            },
            {
              text: 'Go to **Cards → Issue card** (as a Controller) — the form is prefilled with these defaults (AC-01).',
            },
          ],
        },
        {
          id: 'mcc',
          title: 'Search the merchant categories',
          steps: [
            {
              text: 'In the restriction search, type a name like **office** or a code like **5943** — both resolve (AC-02).',
            },
          ],
        },
        {
          id: 'issuance',
          title: 'Restrict who can request a card',
          steps: [
            {
              text: 'Set **Who can request a new card** to **Finance Managers and above** and Save — an Employee no longer sees the “Request a card” action (AC-03).',
            },
          ],
        },
      ],
    },
    resetSection,
  ],
};
