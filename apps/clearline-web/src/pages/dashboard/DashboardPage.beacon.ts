import type { DemoBeaconPageConfig, EntityRow } from '@clearline/demo-beacon';
import { SEED_SPEND_TRANSACTIONS } from '@clearline/mock-backend/fixtures';
import { money } from '../../dev/beacon/shared';
import { loadControls } from '../../dev/beacon/shared';
import {
  completeGettingStartedTaskSection,
  gettingStartedGuide,
  resetGettingStartedSection,
  resetSection,
} from '../../dev/beacon/global.beacon';

/** The five biggest seeded transactions, with the anomalous one called out — what the feed shows. */
const rows: EntityRow[] = [...SEED_SPEND_TRANSACTIONS]
  .sort((a, b) => b.amount.amountMinorUnits - a.amount.amountMinorUnits)
  .slice(0, 5)
  .map((t) => ({
    vendor: t.vendor,
    category: t.category,
    amount: money(t.amount),
    note: t.anomaly ? `Flagged · AI ${t.anomaly.confidencePercent}% confidence` : 'Normal',
  }));

/**
 * Spend dashboard guide (US-CW-015). Orients a viewer to what the dashboard encodes — skeleton-first
 * money, anomalies flagged by icon + label + confidence, and sections that fail independently — and
 * hands them the levers to trip each state.
 */
export const dashboardBeacon: DemoBeaconPageConfig = {
  pageId: 'dashboard',
  title: 'Spend overview',
  summary:
    'Real-time spend by **category, department & vendor** for June 2026. Money renders from **skeletons, never $0.00**; the WeWork charge is flagged as an **unusual amount** with an AI confidence score; each section fails behind its own error boundary.',
  sections: [
    {
      kind: 'entities',
      title: 'Seeded activity',
      columns: [
        { key: 'vendor', label: 'Vendor' },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount' },
        { key: 'note', label: 'Anomaly' },
      ],
      rows,
    },
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'empty-range',
          title: 'See the empty state',
          steps: [
            { text: 'Set the range to **Jul 1 – Jul 7, 2026** and hit **Apply range**.' },
            {
              text: 'No transactions match, so the dashboard shows **“No transactions in this date range”** — an empty state, not an error.',
            },
            { text: 'Use **Reset to June 2026** to return to the seeded month.' },
          ],
        },
        {
          id: 'invalid-range',
          title: 'Trip the date validation',
          steps: [
            { text: 'Set the **end date earlier than the start date**.' },
            {
              text: 'The inline error **“End date must be after the start date.”** appears and **Apply range** stays disabled — the filter is never applied until corrected.',
            },
          ],
        },
        {
          id: 'section-failure',
          title: 'Fail one section in isolation',
          steps: [
            { text: 'Turn on **Break the “Top vendors” section** below.' },
            {
              text: 'Press that section’s **Retry** — only it shows **“This section couldn’t load.”**; every other section keeps rendering.',
            },
            { text: 'Turn the toggle off and Retry again to recover it.' },
          ],
        },
      ],
    },
    {
      kind: 'toggles',
      title: 'Scenarios',
      toggles: [
        {
          id: 'break-top-vendors',
          label: 'Break the “Top vendors” section',
          description:
            'While on, the Top vendors endpoint returns a 500 so you can see one section fail behind its own error boundary while the rest of the page renders. Retry that section after toggling to apply it.',
          get: async () => {
            const { isAnalyticsSectionFailureArmedForE2E } = await loadControls();
            return isAnalyticsSectionFailureArmedForE2E('top-vendors');
          },
          set: async (on) => {
            const { setAnalyticsSectionFailureForE2E } = await loadControls();
            setAnalyticsSectionFailureForE2E('top-vendors', on);
          },
        },
      ],
    },
    gettingStartedGuide,
    completeGettingStartedTaskSection,
    resetGettingStartedSection,
    resetSection,
  ],
};
