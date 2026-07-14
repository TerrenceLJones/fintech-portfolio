import type { QueryClient } from '@tanstack/react-query';
import type { ActionsSection, DemoBeaconPageConfig, EntityRow } from '@clearline/demo-beacon';
import { SEED_INTENTS } from '@clearline/mock-backend/fixtures';
import { money, loadControls } from '../../dev/beacon/shared';

const intentRows: EntityRow[] = SEED_INTENTS.map((i) => ({
  recipient: i.recipientName,
  amount: money(i.amount),
  status: i.status,
  _id: i.id,
}));

/**
 * Payment-detail guide. Because it's built in the page component, the reversal scenario targets the
 * exact `intentId` on screen — no pathname parsing. Reversal stands in for the bank's webhook.
 */
export function buildPaymentStatusBeacon(
  intentId: string,
  queryClient: QueryClient,
): DemoBeaconPageConfig {
  const scenarios: ActionsSection = {
    kind: 'actions',
    title: 'Scenarios',
    actions: intentId
      ? [
          {
            id: 'reverse',
            label: 'Simulate bank reversal',
            description: 'Posts a reversing ledger entry and flips this payment to “Reversed”.',
            variant: 'destructive',
            confirm: 'Reverse this payment?',
            run: async () => {
              const { simulatePaymentReversalForE2E } = await loadControls();
              simulatePaymentReversalForE2E(intentId);
              await queryClient.invalidateQueries({ queryKey: ['payments'] });
            },
          },
        ]
      : [],
  };

  return {
    pageId: 'payments.status',
    title: 'Payment detail',
    summary: 'Open a seeded payment, then simulate the bank’s reversal webhook.',
    sections: [
      {
        kind: 'entities',
        title: 'Seed payments',
        columns: [
          { key: 'recipient', label: 'Recipient' },
          { key: 'amount', label: 'Amount' },
          { key: 'status', label: 'Status' },
        ],
        rows: intentRows,
        rowLink: (row) => `/payments/${row._id}`,
      },
      scenarios,
    ],
  };
}
