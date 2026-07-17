import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { loadControls } from '../../dev/beacon/shared';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Reconciliation guide (US-CW-016). Orients a viewer to the exceptions queue — the handful of bank
 * lines the nightly run couldn't auto-match — and hands them the levers to work each one and to trip
 * the Fatal-tier balance state.
 */
export const reconciliationBeacon: DemoBeaconPageConfig = {
  pageId: 'reconciliation',
  title: 'Reconciliation',
  summary:
    'The nightly job auto-matched the bulk of the **Plaid bank feed**; the work is the **exceptions**. Confirm or reject a **fuzzy suggestion**, **split** a transaction across two invoices, or **dismiss** an unmatched line. The account balance is shown only when the ledger nets — otherwise it is **withheld** (Fatal-tier).',
  sections: [
    {
      kind: 'entities',
      title: 'Seeded exceptions',
      columns: [
        { key: 'transaction', label: 'Bank transaction' },
        { key: 'outcome', label: 'Outcome' },
      ],
      rows: [
        { transaction: 'ABC Corp · $3,200.00', outcome: 'Suggested → "ABC Corporation" (fuzzy)' },
        { transaction: 'Stripe Payout · $7,421.00', outcome: 'Unmatched · no ledger candidate' },
        {
          transaction: 'Acme Wholesale · $5,000.00',
          outcome: 'Unmatched · splits across INV-20418 + INV-20419',
        },
        { transaction: 'WeWork · $4,240.00', outcome: 'Ambiguous · possible duplicate' },
      ],
    },
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'confirm-fuzzy',
          title: 'Confirm a fuzzy match',
          steps: [
            { text: 'On the **ABC Corp** row, press **Review**.' },
            {
              text: 'The dialog shows the **similarity score** and a per-field breakdown (name fuzzy, amount exact, date within 1 day).',
            },
            {
              text: '**Confirm match** reconciles it; **Reject** sends it back to the queue as unmatched.',
            },
          ],
        },
        {
          id: 'split-match',
          title: 'Split one payment across two invoices',
          steps: [
            { text: 'On the **Acme Wholesale** row, press **Split**.' },
            {
              text: 'Change a portion so the amounts don’t total **$5,000.00** — the error **“The split amounts must add up to the full transaction amount.”** shows and **Confirm** stays disabled.',
            },
            {
              text: 'Set them to **$3,000 + $2,000** — the strip turns green and Confirm enables.',
            },
          ],
        },
        {
          id: 'balance-integrity',
          title: 'See the withheld balance',
          steps: [
            { text: 'Turn on **Break the ledger balance integrity** below.' },
            {
              text: 'Press **Run again** — the account balance is **withheld** (a hatched bar, not $0.00) with a support reference.',
            },
            { text: 'Turn the toggle off and **Run again** to restore it.' },
          ],
        },
      ],
    },
    {
      kind: 'toggles',
      title: 'Scenarios',
      toggles: [
        {
          id: 'break-exceptions',
          label: 'Break the "Exceptions" panel',
          description:
            'While on, the exceptions endpoint returns a 500 so you can see one panel fail behind its own error boundary while the summary, matched and balance panels render. Press Run again (or the panel’s Retry) to apply it.',
          get: async () => {
            const { isReconciliationSectionFailureArmedForE2E } = await loadControls();
            return isReconciliationSectionFailureArmedForE2E('exceptions');
          },
          set: async (on) => {
            const { setReconciliationSectionFailureForE2E } = await loadControls();
            setReconciliationSectionFailureForE2E('exceptions', on);
          },
        },
        {
          id: 'break-balance',
          label: 'Break the ledger balance integrity',
          description:
            'While on, the account’s postings no longer net to the derived balance, so the balance is withheld and the Fatal-tier "we’re double-checking your balance" state shows instead of a number. Press Run again to refresh it.',
          get: async () => {
            const { isReconciliationBalanceFailureArmedForE2E } = await loadControls();
            return isReconciliationBalanceFailureArmedForE2E();
          },
          set: async (on) => {
            const { setReconciliationBalanceFailureForE2E } = await loadControls();
            setReconciliationBalanceFailureForE2E(on);
          },
        },
      ],
    },
    resetSection,
  ],
};
