import { describe, expect, it } from 'vitest';
import { permissionsForRole } from '@clearline/domain-auth';
import { ApprovalsService, type ApprovalActor } from './approvals.service';

function actor(overrides: Partial<ApprovalActor> = {}): ApprovalActor {
  return {
    userId: 'user_1',
    displayName: 'Marcus Okafor',
    permissions: permissionsForRole('finance_manager', { isAdmin: false }),
    approvalLimit: 1_000_000,
    ...overrides,
  };
}

const employee = actor({
  permissions: permissionsForRole('employee', { isAdmin: false }),
  approvalLimit: null,
});
const controller = actor({
  permissions: permissionsForRole('controller', { isAdmin: false }),
  approvalLimit: null,
});

describe('ApprovalsService.getQueue', () => {
  it('returns the pending items for a permitted role', () => {
    const result = new ApprovalsService().getQueue(actor());
    expect(result.outcome).toBe('ok');
    if (result.outcome === 'ok') {
      expect(result.items.map((i) => i.id)).toContain('exp_4201');
    }
  });

  it('is forbidden for a role without approvals:view (Employee)', () => {
    expect(new ApprovalsService().getQueue(employee)).toEqual({ outcome: 'forbidden' });
  });
});

describe('ApprovalsService.approve', () => {
  it('approves an in-limit expense submitted by someone else and removes it from the queue', () => {
    const service = new ApprovalsService();
    const result = service.approve('exp_4201', actor());
    expect(result.outcome).toBe('ok');

    const queue = service.getQueue(actor());
    if (queue.outcome === 'ok') {
      expect(queue.items.map((i) => i.id)).not.toContain('exp_4201');
    }
  });

  it('blocks an over-limit approval with the caller’s limit attached (AC-06)', () => {
    expect(new ApprovalsService().approve('exp_4471', actor())).toEqual({
      outcome: 'forbidden',
      reason: 'approval_limit_exceeded',
      approvalLimit: 1_000_000,
    });
  });

  it('blocks approving your own expense (AC-07)', () => {
    expect(new ApprovalsService().approve('exp_4460', actor())).toEqual({
      outcome: 'forbidden',
      reason: 'self_approval_blocked',
    });
  });

  it('blocks a role without approval authority (Employee)', () => {
    expect(new ApprovalsService().approve('exp_4201', employee)).toEqual({
      outcome: 'forbidden',
      reason: 'forbidden_role',
    });
  });

  it('lets a Controller approve an over-$10k expense (unlimited)', () => {
    expect(new ApprovalsService().approve('exp_4471', controller).outcome).toBe('ok');
  });

  it('returns not_found for an unknown expense id', () => {
    expect(new ApprovalsService().approve('nope', actor())).toEqual({ outcome: 'not_found' });
  });
});

describe('ApprovalsService.reject', () => {
  it('removes a rejected item from the queue and records the reason (US-CW-012 AC-02)', () => {
    const service = new ApprovalsService();
    expect(service.reject('exp_4201', actor(), 'Out of policy').outcome).toBe('ok');
    const queue = service.getQueue(actor());
    if (queue.outcome === 'ok') {
      expect(queue.items.map((i) => i.id)).not.toContain('exp_4201');
    }
    expect(service.getResolution('exp_4201')).toEqual({
      action: 'rejected',
      actedBy: 'Marcus Okafor',
      reason: 'Out of policy',
    });
  });

  it('blocks a role without approval authority', () => {
    expect(new ApprovalsService().reject('exp_4201', employee, 'Out of policy')).toEqual({
      outcome: 'forbidden',
      reason: 'forbidden_role',
    });
  });
});

describe('ApprovalsService stale-action concurrency (US-CW-012 AC-05)', () => {
  it('returns a conflict naming the approver who already approved the item', () => {
    const service = new ApprovalsService();
    expect(service.approve('exp_4201', actor()).outcome).toBe('ok');
    // A second, stale approve from another approver's outdated queue view.
    expect(
      service.approve('exp_4201', actor({ userId: 'user_9', displayName: 'Jamie Lin' })),
    ).toEqual({ outcome: 'conflict', actedBy: 'Marcus Okafor' });
  });

  it('returns a conflict when approving an item another approver already rejected', () => {
    const service = new ApprovalsService();
    service.reject('exp_4201', actor(), 'Duplicate');
    expect(service.approve('exp_4201', controller)).toEqual({
      outcome: 'conflict',
      actedBy: 'Marcus Okafor',
    });
  });

  it('still returns not_found for an id that never existed', () => {
    expect(new ApprovalsService().approve('nope', actor())).toEqual({ outcome: 'not_found' });
  });
});

describe('ApprovalsService.enqueue (submitted expenses join the queue)', () => {
  it('adds a submitted expense so an approver sees it in the queue (US-CW-011 AC-01)', () => {
    const service = new ApprovalsService();
    service.enqueue({
      id: 'exp_9001',
      submitterId: 'user_77',
      submitterName: 'Nadia Hassan',
      category: 'Travel',
      amount: { amountMinorUnits: 30_000, currency: 'USD' },
      submittedDate: '2026-07-14',
      status: 'pending_l1',
    });
    const queue = service.getQueue(actor());
    if (queue.outcome === 'ok') {
      expect(queue.items.map((i) => i.id)).toContain('exp_9001');
    }
  });
});

describe('ApprovalsService.escalate', () => {
  it('routes an over-limit expense to L2 with the escalating manager recorded', () => {
    const service = new ApprovalsService();
    const result = service.escalate('exp_4471', actor());
    expect(result.outcome).toBe('ok');
    if (result.outcome === 'ok') {
      expect(result.item.status).toBe('pending_l2');
      expect(result.item.escalatedBy).toBe('Marcus Okafor');
    }
  });

  it('blocks escalation from a role without approval authority', () => {
    expect(new ApprovalsService().escalate('exp_4471', employee)).toEqual({
      outcome: 'forbidden',
      reason: 'forbidden_role',
    });
  });

  it('drops the escalated item from the escalating manager’s queue but routes it to a Controller (US-CW-012 AC-04)', () => {
    const service = new ApprovalsService();
    service.escalate('exp_4471', actor());

    // The Finance Manager who escalated it can no longer action it — it has been handed to L2.
    const managerQueue = service.getQueue(actor());
    if (managerQueue.outcome === 'ok') {
      expect(managerQueue.items.map((i) => i.id)).not.toContain('exp_4471');
    }

    // A Controller (no limit ceiling) sees it in their queue as a pending_l2 escalation.
    const controllerQueue = service.getQueue(controller);
    if (controllerQueue.outcome === 'ok') {
      const routed = controllerQueue.items.find((i) => i.id === 'exp_4471');
      expect(routed?.status).toBe('pending_l2');
      expect(routed?.escalatedBy).toBe('Marcus Okafor');
    }
  });

  it('still shows non-escalated (pending_l1) items to a Finance Manager', () => {
    const service = new ApprovalsService();
    const queue = service.getQueue(actor());
    if (queue.outcome === 'ok') {
      // exp_4201 is a plain L1 item — a limited manager still sees it.
      expect(queue.items.map((i) => i.id)).toContain('exp_4201');
    }
  });
});

describe('ApprovalsService.reassign', () => {
  it('removes a reassigned item from the queue', () => {
    const service = new ApprovalsService();
    expect(service.reassign('exp_4201', actor()).outcome).toBe('ok');
    const queue = service.getQueue(actor());
    if (queue.outcome === 'ok') {
      expect(queue.items.map((i) => i.id)).not.toContain('exp_4201');
    }
  });

  it('lets an approver reassign their own submission (self-approval is not a reassign block)', () => {
    // exp_4460 is submitted by user_1 (the acting approver) — approve is blocked, but reassign is
    // the sanctioned escape hatch and must succeed (AC-08).
    const service = new ApprovalsService();
    const result = service.reassign('exp_4460', actor());
    expect(result.outcome).toBe('ok');
    const queue = service.getQueue(actor());
    if (queue.outcome === 'ok') {
      expect(queue.items.map((i) => i.id)).not.toContain('exp_4460');
    }
  });

  it('blocks reassignment from a role without approval authority', () => {
    expect(new ApprovalsService().reassign('exp_4201', employee)).toEqual({
      outcome: 'forbidden',
      reason: 'forbidden_role',
    });
  });
});

describe('ApprovalsService per-item idempotency (US-CW-013 AC-02)', () => {
  it('replays the original success for a repeated idempotency key instead of a 409, applying it exactly once', () => {
    const service = new ApprovalsService();
    const first = service.approve('exp_4201', actor(), 'idem-1');
    expect(first.outcome).toBe('ok');

    // A retry of a failed/unprocessed batch re-sends the SAME key — it must NOT double-apply or 409.
    const replay = service.approve('exp_4201', actor(), 'idem-1');
    expect(replay).toEqual(first);

    // Exactly one audit event was written for the two identical-key calls.
    expect(service.getAuditLog().filter((e) => e.itemId === 'exp_4201')).toHaveLength(1);
  });

  it('still returns a 409 conflict for a stale re-approve that carries no idempotency key', () => {
    const service = new ApprovalsService();
    expect(service.approve('exp_4201', actor(), 'idem-1').outcome).toBe('ok');
    // No key (a genuinely stale action from an outdated queue) still reconciles to server truth.
    expect(service.approve('exp_4201', actor())).toEqual({
      outcome: 'conflict',
      actedBy: 'Marcus Okafor',
    });
  });

  it('does not cache a forbidden outcome, so a fresh attempt is re-evaluated', () => {
    const service = new ApprovalsService();
    // Over-limit for a manager is forbidden and has no side effect — a later Controller retry with the
    // same key must be re-evaluated on its own authority, not served the cached forbidden.
    expect(service.approve('exp_4471', actor(), 'idem-2').outcome).toBe('forbidden');
    expect(service.approve('exp_4471', controller, 'idem-2').outcome).toBe('ok');
  });

  it('reuses a rejection idempotency key so a resumed reject applies once', () => {
    const service = new ApprovalsService();
    const first = service.reject('exp_4201', actor(), 'Missing receipts', 'rej-1');
    expect(first.outcome).toBe('ok');
    expect(service.reject('exp_4201', actor(), 'Missing receipts', 'rej-1')).toEqual(first);
    expect(service.getAuditLog().filter((e) => e.itemId === 'exp_4201')).toHaveLength(1);
  });
});

describe('ApprovalsService per-employee notifications (US-CW-013 AC-04)', () => {
  it('notifies the submitter individually on approval', () => {
    const service = new ApprovalsService();
    service.approve('exp_4201', actor());
    expect(service.getNotifications()).toEqual([
      expect.objectContaining({ submitterId: 'user_201', itemId: 'exp_4201', action: 'approved' }),
    ]);
  });

  it('notifies each rejected submitter individually with the shared reason (not one batched message)', () => {
    const service = new ApprovalsService();
    service.reject('exp_4201', actor(), 'Missing receipts');
    service.reject('exp_4202', actor(), 'Missing receipts');

    const notifications = service.getNotifications();
    expect(notifications).toHaveLength(2);
    expect(notifications.map((n) => n.submitterId)).toEqual(['user_201', 'user_202']);
    expect(
      notifications.every((n) => n.action === 'rejected' && n.reason === 'Missing receipts'),
    ).toBe(true);
  });

  it('does not emit a second notification when an idempotent action is replayed', () => {
    const service = new ApprovalsService();
    service.approve('exp_4201', actor(), 'idem-1');
    service.approve('exp_4201', actor(), 'idem-1');
    expect(service.getNotifications()).toHaveLength(1);
  });
});
