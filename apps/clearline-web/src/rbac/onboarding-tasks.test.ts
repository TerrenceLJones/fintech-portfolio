import { describe, expect, it } from 'vitest';
import type { Permission } from '@clearline/contracts';
import { permissionsForRole } from '@clearline/domain-auth';
import { onboardingTaskById, onboardingTasksForPermissions } from './onboarding-tasks';

/** Build the same can() predicate the app uses, from the real permission source (US-CW-045 AC-01). */
function canFor(
  role: Parameters<typeof permissionsForRole>[0],
  { isAdmin = false, isOwner = false }: { isAdmin?: boolean; isOwner?: boolean } = {},
) {
  const perms = permissionsForRole(role, { isAdmin, isOwner });
  return (permission: Permission) => perms.includes(permission);
}

const CAN_NOTHING = () => false;

describe('onboardingTasksForPermissions', () => {
  it('gives an Employee exactly two tasks, led by the signature "Submit your first expense" (AC-02)', () => {
    const tasks = onboardingTasksForPermissions(canFor('employee'), {
      isOwner: false,
      isAdmin: false,
    });
    expect(tasks.map((t) => t.id)).toEqual(['submit-expense', 'see-cards']);
    expect(tasks[0]?.isSignature).toBe(true);
    expect(tasks[0]?.path).toBe('/expenses/new');
    // No filler is invented to reach a target length (AC-02).
    expect(tasks).toHaveLength(2);
  });

  it('leads a Finance Manager with "Clear your first approval", then dashboard, payment, reconcile (AC-03)', () => {
    const tasks = onboardingTasksForPermissions(canFor('finance_manager'), {
      isOwner: false,
      isAdmin: false,
    });
    expect(tasks.map((t) => t.id)).toEqual([
      'clear-approval',
      'read-dashboard',
      'send-payment',
      'reconcile-transactions',
    ]);
    expect(tasks[0]?.isSignature).toBe(true);
  });

  it('leads an invited Controller with "Issue your first virtual card", then budget and audit — no setup script (AC-04)', () => {
    const tasks = onboardingTasksForPermissions(canFor('controller'), {
      isOwner: false,
      isAdmin: false,
    });
    expect(tasks.map((t) => t.id)).toEqual(['issue-card', 'set-budget', 'review-audit']);
    expect(tasks[0]?.isSignature).toBe(true);
    // The invited Controller does NOT receive the Owner empty-org invite-team lead.
    expect(tasks.map((t) => t.id)).not.toContain('invite-team');
  });

  it('gives the Owner the workspace-setup variant led by "Invite your team" (AC-05)', () => {
    const tasks = onboardingTasksForPermissions(canFor('controller', { isOwner: true }), {
      isOwner: true,
      isAdmin: false,
    });
    expect(tasks.map((t) => t.id)).toEqual([
      'invite-team',
      'set-budget',
      'issue-card',
      'read-dashboard',
    ]);
    expect(tasks[0]?.isSignature).toBe(true);
    expect(tasks[0]?.path).toBe('/settings/team');
  });

  it('selects the Owner variant by isOwner, not by tier — Owner and invited Controller share permissions but differ (AC-05)', () => {
    const owner = onboardingTasksForPermissions(canFor('controller', { isOwner: true }), {
      isOwner: true,
      isAdmin: false,
    });
    const invited = onboardingTasksForPermissions(canFor('controller'), {
      isOwner: false,
      isAdmin: false,
    });
    expect(owner[0]?.id).toBe('invite-team');
    expect(invited[0]?.id).toBe('issue-card');
    expect(owner.map((t) => t.id)).not.toEqual(invited.map((t) => t.id));
  });

  it('appends a non-signature "Invite your team" for an Admin who is not the Owner (AC-06)', () => {
    const tasks = onboardingTasksForPermissions(canFor('employee', { isAdmin: true }), {
      isOwner: false,
      isAdmin: true,
    });
    expect(tasks.map((t) => t.id)).toEqual(['submit-expense', 'see-cards', 'invite-team']);
    // The appended team task is NOT the signature — the role's first action still is (AC-06 / AC-07).
    expect(tasks[0]?.isSignature).toBe(true);
    expect(tasks.find((t) => t.id === 'invite-team')?.isSignature).toBe(false);
  });

  it('keeps the role signature when an Admin Controller gets the appended invite-team (AC-06)', () => {
    const tasks = onboardingTasksForPermissions(canFor('controller', { isAdmin: true }), {
      isOwner: false,
      isAdmin: true,
    });
    expect(tasks.map((t) => t.id)).toEqual([
      'issue-card',
      'set-budget',
      'review-audit',
      'invite-team',
    ]);
    expect(tasks[0]?.isSignature).toBe(true);
  });

  it('carries at most one signature task, and it is always the first (AC-07)', () => {
    for (const tasks of [
      onboardingTasksForPermissions(canFor('employee'), { isOwner: false, isAdmin: false }),
      onboardingTasksForPermissions(canFor('finance_manager'), { isOwner: false, isAdmin: false }),
      onboardingTasksForPermissions(canFor('controller'), { isOwner: false, isAdmin: false }),
      onboardingTasksForPermissions(canFor('controller', { isOwner: true }), {
        isOwner: true,
        isAdmin: false,
      }),
    ]) {
      const signatures = tasks.filter((t) => t.isSignature);
      expect(signatures).toHaveLength(1);
      expect(signatures[0]).toBe(tasks[0]);
    }
  });

  it('includes only tasks whose required permission is held — never a role string (AC-01)', () => {
    const tasks = onboardingTasksForPermissions(canFor('finance_manager'), {
      isOwner: false,
      isAdmin: false,
    });
    // A Finance Manager lacks cards:manage / budget:view, so those tasks never appear.
    expect(tasks.map((t) => t.id)).not.toContain('issue-card');
    expect(tasks.map((t) => t.id)).not.toContain('set-budget');
    expect(tasks.map((t) => t.id)).not.toContain('review-audit');
  });

  it('applies the Owner ordering over the Employee permission set, keeping only held tasks (edge case)', () => {
    // Employee who is also Owner: workspace-setup ordering, but only invite-team is permitted.
    const tasks = onboardingTasksForPermissions(canFor('employee', { isOwner: true }), {
      isOwner: true,
      isAdmin: false,
    });
    expect(tasks.map((t) => t.id)).toEqual(['invite-team']);
    expect(tasks[0]?.isSignature).toBe(true);
  });

  it('produces an empty set when the permission predicate grants nothing (US-CW-044 AC-07 suppresses the launcher)', () => {
    expect(onboardingTasksForPermissions(CAN_NOTHING, { isOwner: false, isAdmin: false })).toEqual(
      [],
    );
  });

  it('is deterministic — the same permission set + isOwner yields the same order every call (AC-08)', () => {
    const args = [canFor('controller'), { isOwner: false, isAdmin: false }] as const;
    const a = onboardingTasksForPermissions(...args).map((t) => t.id);
    const b = onboardingTasksForPermissions(...args).map((t) => t.id);
    expect(a).toEqual(b);
  });
});

describe('onboardingTaskById', () => {
  it('resolves a task definition by id', () => {
    expect(onboardingTaskById('issue-card')?.path).toBe('/cards/new');
    expect(onboardingTaskById('invite-team')?.path).toBe('/settings/team');
  });

  it('returns undefined for an unknown id', () => {
    // @ts-expect-error — exercising the runtime guard for an id outside the union.
    expect(onboardingTaskById('nope')).toBeUndefined();
  });
});
