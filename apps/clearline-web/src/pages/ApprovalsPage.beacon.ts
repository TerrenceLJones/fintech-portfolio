import type { DemoBeaconPageConfig, EntityRow } from '@clearline/demo-beacon';
import { SEED_APPROVALS } from '@clearline/mock-backend/fixtures';
import { money } from '../dev/beacon/shared';

const DEMO_SUBMITTER_ID = 'user_1';

function note(amountMinorUnits: number, submitterId: string): string {
  if (amountMinorUnits > 1_000_000) return 'Over your limit → Escalate (AC-06)';
  if (submitterId === DEMO_SUBMITTER_ID) return 'Your own request → Reassign (AC-07)';
  return 'Approves cleanly';
}

const rows: EntityRow[] = SEED_APPROVALS.map((a) => ({
  submitter: a.submitterName,
  category: a.category,
  amount: money(a.amount),
  note: note(a.amount.amountMinorUnits, a.submitterId),
}));

/** Approvals guide: the seeded queue and the two guardrail cases it's shaped to trip. */
export const approvalsBeacon: DemoBeaconPageConfig = {
  pageId: 'approvals',
  title: 'Approvals queue',
  summary:
    'Four seeded requests. As a $10,000 Finance Manager, two are shaped to hit your guardrails.',
  sections: [
    {
      kind: 'entities',
      title: 'Seed queue',
      columns: [
        { key: 'submitter', label: 'Submitter' },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount' },
        { key: 'note', label: 'Behavior' },
      ],
      rows,
    },
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'guardrails',
          title: 'Exercise the guardrails',
          steps: [
            { text: 'Approve **Priya Nair’s** $4,200 request — it clears.' },
            {
              text: 'Try **Tom Becker’s** $15,000 request — over your limit, so it offers **Escalate**.',
            },
            {
              text: 'Try your **own** $180 Meals request — self-approval is blocked, so it offers **Reassign**.',
            },
          ],
        },
      ],
    },
  ],
};
