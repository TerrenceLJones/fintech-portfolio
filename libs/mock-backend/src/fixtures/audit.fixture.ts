import type { AuditEvent } from '@clearline/contracts';

/**
 * The seeded audit trail the log view opens onto (US-CW-021). Hand-picked so a viewer sees one event
 * of every category the log must cover, mirroring the design's §18 rows:
 *   - a payment submission with amount → recipient and its idempotency key + outcome (AC-01),
 *   - an approval decision with a Pending → Approved diff (AC-02),
 *   - a card freeze with an Active → Frozen diff (AC-03),
 *   - a role change with a Finance Manager → Employee diff (AC-04),
 *   - a prior "Viewed audit log" access event, itself auditable (AC-06).
 * Actors are the seeded users (see users.fixture) where the action has a live flow; the role change,
 * which has no live flow yet (team management is still Planned), names its target inline. Timestamps
 * sit in the demo's June-2026 window and are ISO-8601 so they sort newest-first without a parse.
 */
export const SEED_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'audit_seed_approval',
    timestamp: '2026-06-29T14:22:07.000Z',
    actor: { id: 'user_1', name: 'Marcus Okafor', role: 'finance_manager' },
    category: 'approval',
    action: 'Approved expense',
    target: { label: 'exp-4490', ref: 'exp-4490' },
    diff: { from: 'Pending L1', to: 'Approved', tone: 'positive' },
  },
  {
    id: 'audit_seed_card_freeze',
    timestamp: '2026-06-29T13:40:12.000Z',
    actor: { id: 'user_3', name: 'Sofia Whitman', role: 'controller' },
    category: 'card_control',
    action: 'Froze card',
    target: { label: '•••• 5567', ref: 'card_5567' },
    diff: { from: 'Active', to: 'Frozen', tone: 'neutral' },
  },
  {
    id: 'audit_seed_role_change',
    timestamp: '2026-06-29T11:05:33.000Z',
    actor: { id: 'user_3', name: 'Sofia Whitman', role: 'controller' },
    category: 'role_change',
    action: 'Changed role · J. Lin',
    target: { label: 'J. Lin' },
    diff: { from: 'Finance Manager', to: 'Employee', tone: 'warning' },
  },
  {
    id: 'audit_seed_payment',
    timestamp: '2026-06-29T09:12:48.000Z',
    actor: { id: 'user_1', name: 'Marcus Okafor', role: 'finance_manager' },
    category: 'payment',
    action: 'Submitted payment',
    target: { label: 'pi_8f2a', ref: 'pi_8f2a' },
    detail: '$12,400.00 → Acme Corp',
    meta: {
      amount: { amountMinorUnits: 1_240_000, currency: 'USD' },
      recipient: 'Acme Corp',
      idempotencyKey: 'idem_8f2a4c19',
      outcome: 'submitted',
    },
  },
  {
    id: 'audit_seed_view',
    timestamp: '2026-06-29T08:55:01.000Z',
    actor: { id: 'user_3', name: 'Sofia Whitman', role: 'controller' },
    category: 'audit_access',
    action: 'Viewed audit log',
  },
];
