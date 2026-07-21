import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Spend Controls demo guide (US-CW-037). Registered by SpendControlsPage so it overrides the layout-level
 * settings guide while mounted. It teaches that the receipt/memo thresholds, out-of-policy behavior, and
 * per-category monthly caps set here are enforced at expense submission (AC-06/07/08) — the same policy
 * model, no copy — and that turning on "Block entirely" confirms first because it is consequential.
 * Organization-group: it only renders for a Controller, Admin, or Owner; the API refuses everyone else.
 */
export const spendControlsBeacon: DemoBeaconPageConfig = {
  pageId: 'settings.spend-controls',
  title: 'Spend Controls',
  summary:
    'Set the **receipt** and **memo** thresholds, the **out-of-policy** behavior, and per-category ' +
    '**monthly caps**. Everything here is enforced when an expense is submitted — the same policy the ' +
    'submission form and dashboard read.',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'thresholds',
          title: 'Require a memo over a threshold',
          steps: [
            {
              text: 'Set **Memo required for expenses over** to e.g. **$200** and **Save changes**.',
            },
            {
              text: 'Submit an expense over that amount with no memo — it is blocked at submission (AC-06).',
            },
          ],
        },
        {
          id: 'block',
          title: 'Block out-of-policy expenses',
          steps: [
            {
              text: 'Change **Out-of-policy expenses** to **Block entirely** and Save — a confirmation spells out the consequence before it takes effect (AC-07).',
            },
          ],
        },
        {
          id: 'caps',
          title: 'Cap a category’s monthly spend',
          steps: [
            {
              text: 'Give a category a monthly cap and Save; a submission that would push month-to-date spend over it is blocked (AC-08).',
            },
            {
              text: '**Restore unlimited** removes the cap and the column reads “Unlimited” again.',
            },
          ],
        },
      ],
    },
    resetSection,
  ],
};
