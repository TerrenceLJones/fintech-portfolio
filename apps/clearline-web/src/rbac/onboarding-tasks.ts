import type { OnboardingTaskId, Permission } from '@clearline/contracts';
import type { IconName } from '@clearline/icons';

/**
 * The getting-started task catalogue (EPIC-CW-023 / US-CW-045). This is to the onboarding launcher
 * what nav-items.ts is to the sidebar: a permission-keyed table of app-layer concerns (title, icon,
 * destination, completion trigger). A task is only ever offered to a persona that holds its
 * `permission` — the same can() predicate that gates the nav link gates the onboarding task — so any
 * change to ROLE_PERMISSIONS re-shapes onboarding for free, with no second list to keep in sync.
 *
 * Which tasks appear is a pure function of permissions; the *order* and the Owner first-run variant
 * are the one place a flag beyond the permission set is read (isOwner / isAdmin — see
 * onboardingTasksForPermissions). US-CW-044 renders these; US-CW-046 anchors on-page spotlights to
 * their destinations; US-CW-047 records completion against their ids.
 */
export interface OnboardingTaskDef {
  id: OnboardingTaskId;
  /** The single permission this task requires, mirroring NavItemDef.permission. */
  permission?: Permission;
  title: string;
  /** One-line description shown in the launchpad panel row. */
  description: string;
  icon: IconName;
  /** Deep-link destination the task's action navigates to. */
  path: string;
  /** Verb shown on the row's action button (Submit / Issue / Invite / Set / Open / View). */
  cta: string;
  /**
   * How completion is observed (US-CW-047). `event` tasks are recorded server-side when the domain
   * action fires (an expense submitted, a card issued, …); `visit` tasks are recorded when the user
   * reaches the destination page. Neither is ever a manual check-off (US-CW-047 AC-02).
   */
  completion: { kind: 'event' } | { kind: 'visit' };
}

/** A catalogue entry resolved for a persona, carrying whether it is that persona's signature action. */
export interface OnboardingTask extends OnboardingTaskDef {
  /** The single "signature" (milestone) task for the persona — always the first in the ordered set. */
  isSignature: boolean;
}

const TASKS: Record<OnboardingTaskId, OnboardingTaskDef> = {
  'submit-expense': {
    id: 'submit-expense',
    permission: 'expenses:view',
    title: 'Submit your first expense',
    description: 'Log a purchase and send it for approval.',
    icon: 'file-text',
    path: '/expenses/new',
    cta: 'Submit',
    completion: { kind: 'event' },
  },
  'see-cards': {
    id: 'see-cards',
    permission: 'cards:view',
    title: 'See your cards',
    description: 'View the cards issued to you and their limits.',
    icon: 'copy',
    path: '/cards',
    cta: 'View',
    completion: { kind: 'visit' },
  },
  'clear-approval': {
    id: 'clear-approval',
    permission: 'approvals:act',
    title: 'Clear your first approval',
    description: 'Review a pending request and make the call.',
    icon: 'check',
    path: '/approvals',
    cta: 'Open',
    completion: { kind: 'event' },
  },
  'read-dashboard': {
    id: 'read-dashboard',
    permission: 'analytics:view',
    title: 'Read your spend dashboard',
    description: 'See spend as it happens across the org.',
    icon: 'bar-chart',
    path: '/dashboard',
    cta: 'Open',
    completion: { kind: 'visit' },
  },
  'send-payment': {
    id: 'send-payment',
    permission: 'payments:create',
    title: 'Send a payment',
    description: 'Pay a vendor with an idempotent transfer.',
    icon: 'arrow-right-circle',
    path: '/payments/new',
    cta: 'Open',
    completion: { kind: 'event' },
  },
  'reconcile-transactions': {
    id: 'reconcile-transactions',
    permission: 'reconciliation:view',
    title: 'Reconcile transactions',
    description: 'Match transactions against your records.',
    icon: 'refresh',
    path: '/reconciliation',
    cta: 'Open',
    completion: { kind: 'visit' },
  },
  'issue-card': {
    id: 'issue-card',
    permission: 'cards:manage',
    title: 'Issue your first virtual card',
    description: 'Create a card with its own limit and controls.',
    icon: 'copy',
    path: '/cards/new',
    cta: 'Issue',
    completion: { kind: 'event' },
  },
  'set-budget': {
    id: 'set-budget',
    permission: 'budget:view',
    title: 'Set a budget',
    description: 'Give a department a spending limit to track against.',
    icon: 'bar-chart',
    path: '/budgets/new',
    cta: 'Set',
    completion: { kind: 'event' },
  },
  'review-audit': {
    id: 'review-audit',
    permission: 'audit:view',
    title: 'Review the audit log',
    description: 'See who did what across the organization.',
    icon: 'clock',
    path: '/audit',
    cta: 'Open',
    completion: { kind: 'visit' },
  },
  'invite-team': {
    id: 'invite-team',
    permission: 'team:view',
    title: 'Invite your team',
    description: 'Add teammates so they can submit expenses and get cards.',
    icon: 'users',
    // Team & Members lives under Settings (US-CW-033) — there is no top-level /team route.
    path: '/settings/team',
    cta: 'Invite',
    completion: { kind: 'event' },
  },
};

/**
 * Per-persona orderings. The signature action leads each list (US-CW-045 AC-07). The Owner ordering
 * is the "stand up your empty workspace" script; the others put the role's single most important
 * first action first. Tiers below the Owner are derived from permissions, not from a role string
 * (cards:manage ⇒ Controller surface, approvals:act ⇒ Finance Manager surface, else Employee).
 */
const OWNER_ORDER: OnboardingTaskId[] = [
  'invite-team',
  'set-budget',
  'issue-card',
  'read-dashboard',
];
const CONTROLLER_ORDER: OnboardingTaskId[] = ['issue-card', 'set-budget', 'review-audit'];
const FINANCE_MANAGER_ORDER: OnboardingTaskId[] = [
  'clear-approval',
  'read-dashboard',
  'send-payment',
  'reconcile-transactions',
];
const EMPLOYEE_ORDER: OnboardingTaskId[] = ['submit-expense', 'see-cards'];

/**
 * Every task id, signatures first — used by the dev/demo beacon to offer a "complete this task"
 * shortcut for each one (so a tester can drive the launcher to any state without orchestrating a
 * multi-user flow). Not used by the production selection below.
 */
export const ONBOARDING_TASK_IDS: OnboardingTaskId[] = [
  'submit-expense',
  'clear-approval',
  'issue-card',
  'invite-team',
  'see-cards',
  'read-dashboard',
  'send-payment',
  'reconcile-transactions',
  'set-budget',
  'review-audit',
];

/** The task definition for an id, or undefined for an unknown id. */
export function onboardingTaskById(id: OnboardingTaskId): OnboardingTaskDef | undefined {
  return TASKS[id];
}

/**
 * The ordered, permission-scoped getting-started task set for a persona (US-CW-045).
 *
 * Selection reads the permission predicate for *inclusion* and the isOwner / isAdmin flags only for
 * *ordering and variant*:
 *  - isOwner            → the workspace-setup ordering (empty-org founder), led by "Invite your team".
 *  - can('cards:manage')→ the Controller ordering, led by "Issue your first virtual card".
 *  - can('approvals:act')→ the Finance Manager ordering, led by "Clear your first approval".
 *  - otherwise          → the Employee ordering, led by "Submit your first expense".
 *  - isAdmin && !isOwner → a non-signature "Invite your team" is appended to whatever the tier yields.
 *
 * The chosen ordering is then filtered by can() so a persona is never offered a task it can't perform
 * (keeps the set honest under mid-session access change — US-CW-044 AC-08 — and the Employee+Owner
 * edge case). The first surviving task is flagged as the signature (AC-07). Order is fixed per input,
 * so the result is deterministic (AC-08).
 */
export function onboardingTasksForPermissions(
  can: (permission: Permission) => boolean,
  { isOwner, isAdmin }: { isOwner: boolean; isAdmin: boolean },
): OnboardingTask[] {
  const order = isOwner
    ? OWNER_ORDER
    : can('cards:manage')
      ? CONTROLLER_ORDER
      : can('approvals:act')
        ? FINANCE_MANAGER_ORDER
        : EMPLOYEE_ORDER;

  const ids = [...order];
  if (isAdmin && !isOwner && !ids.includes('invite-team')) ids.push('invite-team');

  const tasks = ids
    .map((id) => TASKS[id])
    .filter((task) => task.permission === undefined || can(task.permission));

  return tasks.map((task, index) => ({ ...task, isSignature: index === 0 }));
}
