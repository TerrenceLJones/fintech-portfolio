import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Approval Policies demo guide (US-CW-037). Registered by ApprovalPoliciesPage so it overrides the
 * layout-level settings guide while mounted. It teaches the one thing this page is about: the tier ladder
 * edited here IS the model the expense routing consumes (AC-10) — editing it changes where expenses route
 * — and that the validator refuses to save a policy with a gap or overlap, naming the exact conflict.
 * Organization-group: it only renders for a Controller, Admin, or Owner; the API refuses everyone else.
 */
export const approvalPoliciesBeacon: DemoBeaconPageConfig = {
  pageId: 'settings.approval-policies',
  title: 'Approval Policies',
  summary:
    'Route each expense to the right approver by **amount**. The tier ladder you edit here is the ' +
    'exact model the approval routing consumes — change a tier and routing changes with it. Tiers ' +
    'must cover every amount from **$0** up, with **no gaps and no overlaps**.',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'add-tier',
          title: 'Add a tier',
          steps: [
            {
              text: 'Click **+ Add tier** — a new row opens inline (editing happens within the row).',
            },
            {
              text: 'Enter a range and pick an approver — **Auto-approve**, **Finance Manager**, or **Controller** — then **Save** the row.',
            },
            { text: 'The sticky Save bar appears; **Save changes** persists the whole ladder.' },
          ],
        },
        {
          id: 'overlap',
          title: 'See the gap/overlap guardrail',
          steps: [
            {
              text: 'Edit a tier so its range overlaps another — an inline error names the conflicting tier and Save is blocked (AC-03).',
            },
            {
              text: 'Delete a middle tier and Save — the policy is refused with a message naming the exact gap (AC-04).',
            },
          ],
        },
        {
          id: 'reset',
          title: 'Reset to defaults',
          steps: [
            {
              text: '**Reset to defaults** confirms first, spelling out the default ladder, then restores it and drops every custom tier (AC-05).',
            },
          ],
        },
      ],
    },
    resetSection,
  ],
};
