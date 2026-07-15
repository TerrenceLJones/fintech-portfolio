import type { ApprovalErrorCode, ApprovalQueueItem, Permission } from '@clearline/contracts';
import { canApprove, hasPermission } from '@clearline/domain-auth';
import { SEED_APPROVALS } from '../fixtures/approvals.fixture';

/** The resolved acting approver — its permissions/limit come from the session (see approvals.handlers). */
export interface ApprovalActor {
  userId: string;
  displayName: string;
  permissions: readonly Permission[];
  approvalLimit: number | null;
}

export type ApprovalQueueOutcome =
  { outcome: 'ok'; items: ApprovalQueueItem[] } | { outcome: 'forbidden' };

export type ApprovalActionOutcome =
  | { outcome: 'ok'; item: ApprovalQueueItem }
  | { outcome: 'not_found' }
  /** The item was already actioned by another approver before this stale request arrived (AC-05). */
  | { outcome: 'conflict'; actedBy: string }
  | { outcome: 'forbidden'; reason: ApprovalErrorCode; approvalLimit?: number };

/** Escalate/reassign can't hit a stale-action conflict (they don't resolve-then-recheck), so they never return one. */
export type ApprovalSimpleOutcome = Exclude<ApprovalActionOutcome, { outcome: 'conflict' }>;

/** How an item left the pending queue, kept so a later stale action resolves to a 409 with a name (AC-05). */
export interface ApprovalResolution {
  action: 'approved' | 'rejected' | 'reassigned';
  actedBy: string;
  reason?: string;
}

/** Append-only record of every approval decision — who did what (US-CW-012 AC-01's audit requirement). */
export interface ApprovalAuditEvent {
  itemId: string;
  action: 'approved' | 'rejected' | 'escalated' | 'reassigned';
  actorId: string;
  timestamp: number;
}

/**
 * A per-employee notification emitted when their expense is approved or rejected. Bulk actions record
 * one of these per affected submitter — never a single batched message — so every employee is notified
 * individually with the reason that applies to them (US-CW-013 AC-04).
 */
export interface ApprovalNotification {
  submitterId: string;
  itemId: string;
  action: 'approved' | 'rejected';
  reason?: string;
  timestamp: number;
}

/**
 * In-memory approval queue with server-authoritative guardrails. Every mutation runs through
 * @clearline/domain-auth's canApprove — the same rule the client uses to pre-disable — so a caller
 * who bypasses the UI still can't self-approve or exceed their limit (US-CW-006 AC-06/AC-07). State
 * is per-instance; the app binds to the shared singleton (see shared-approvals-service).
 *
 * Resolved items are remembered (not just deleted) so a stale action from an outdated queue view
 * returns a 409 conflict naming who already actioned it, rather than a duplicate approval or a bare
 * 404 (US-CW-012 AC-05). Submitted expenses join the queue via enqueue (US-CW-011).
 */
export class ApprovalsService {
  private readonly items: Map<string, ApprovalQueueItem>;
  private readonly resolved = new Map<string, ApprovalResolution>();
  private readonly auditLog: ApprovalAuditEvent[] = [];
  private readonly notifications: ApprovalNotification[] = [];
  /**
   * Successful approve/reject outcomes keyed by the client's per-item idempotency key. A replay of the
   * same key — a retry of a failed or network-interrupted batch — returns the original result rather
   * than re-applying it or 409-ing, so partial retries can never duplicate a committed decision
   * (US-CW-013 AC-02). Only committed (`ok`) outcomes are cached; a forbidden attempt had no side
   * effect and is re-evaluated on retry.
   */
  private readonly idempotency = new Map<string, ApprovalActionOutcome>();
  private readonly clock: () => number;

  constructor(seed: ApprovalQueueItem[] = SEED_APPROVALS, clock: () => number = () => Date.now()) {
    // Deep-copy each seed item so mutations (escalate) never corrupt the shared fixture array.
    this.items = new Map(seed.map((item) => [item.id, { ...item, amount: { ...item.amount } }]));
    this.clock = clock;
  }

  getQueue(actor: ApprovalActor): ApprovalQueueOutcome {
    if (!hasPermission(actor.permissions, 'approvals:view')) {
      return { outcome: 'forbidden' };
    }
    return { outcome: 'ok', items: [...this.items.values()].map((item) => ({ ...item })) };
  }

  /** Adds a freshly-submitted expense to the pending queue so an approver can act on it (US-CW-011). */
  enqueue(item: ApprovalQueueItem): void {
    this.items.set(item.id, { ...item, amount: { ...item.amount } });
  }

  /** How a resolved item left the queue (approved/rejected/reassigned), or undefined if still pending. */
  getResolution(itemId: string): ApprovalResolution | undefined {
    const resolution = this.resolved.get(itemId);
    return resolution ? { ...resolution } : undefined;
  }

  getAuditLog(): readonly ApprovalAuditEvent[] {
    return this.auditLog.map((event) => ({ ...event }));
  }

  /** Per-employee notifications emitted by approve/reject — one per affected submitter (US-CW-013 AC-04). */
  getNotifications(): readonly ApprovalNotification[] {
    return this.notifications.map((notification) => ({ ...notification }));
  }

  approve(itemId: string, actor: ApprovalActor, idempotencyKey?: string): ApprovalActionOutcome {
    const replay = this.replay(idempotencyKey);
    if (replay) return replay;

    const item = this.items.get(itemId);
    if (!item) return this.missing(itemId);

    const decision = canApprove({
      permissions: actor.permissions,
      approvalLimit: actor.approvalLimit,
      amount: item.amount.amountMinorUnits,
      submitterId: item.submitterId,
      approverId: actor.userId,
    });

    if (!decision.allowed) {
      if (decision.reason === 'approval_limit_exceeded' && actor.approvalLimit !== null) {
        return {
          outcome: 'forbidden',
          reason: decision.reason,
          approvalLimit: actor.approvalLimit,
        };
      }
      return { outcome: 'forbidden', reason: decision.reason };
    }

    // Approved items leave the pending queue — the demo doesn't model an approved/history view.
    this.resolve(itemId, { action: 'approved', actedBy: actor.displayName }, actor.userId);
    this.notify({ submitterId: item.submitterId, itemId, action: 'approved' });
    const outcome: ApprovalActionOutcome = { outcome: 'ok', item: { ...item } };
    this.remember(idempotencyKey, outcome);
    return outcome;
  }

  reject(
    itemId: string,
    actor: ApprovalActor,
    reason: string,
    idempotencyKey?: string,
  ): ApprovalActionOutcome {
    const replay = this.replay(idempotencyKey);
    if (replay) return replay;

    if (!hasPermission(actor.permissions, 'approvals:act')) {
      return { outcome: 'forbidden', reason: 'forbidden_role' };
    }
    const item = this.items.get(itemId);
    if (!item) return this.missing(itemId);

    // Rejected items leave the pending queue; the reason travels back to the submitter (AC-02) — each
    // affected employee gets their own notification carrying the shared reason (US-CW-013 AC-04).
    this.resolve(itemId, { action: 'rejected', actedBy: actor.displayName, reason }, actor.userId);
    this.notify({ submitterId: item.submitterId, itemId, action: 'rejected', reason });
    const outcome: ApprovalActionOutcome = { outcome: 'ok', item: { ...item } };
    this.remember(idempotencyKey, outcome);
    return outcome;
  }

  escalate(itemId: string, actor: ApprovalActor): ApprovalSimpleOutcome {
    if (!hasPermission(actor.permissions, 'approvals:act')) {
      return { outcome: 'forbidden', reason: 'forbidden_role' };
    }
    const item = this.items.get(itemId);
    if (!item) return { outcome: 'not_found' };

    const escalated: ApprovalQueueItem = {
      ...item,
      status: 'pending_l2',
      escalatedBy: actor.displayName,
    };
    // Escalation keeps the item pending (routed to L2), so it is NOT recorded as resolved.
    this.items.set(itemId, escalated);
    this.auditLog.push({
      itemId,
      action: 'escalated',
      actorId: actor.userId,
      timestamp: this.clock(),
    });
    return { outcome: 'ok', item: { ...escalated } };
  }

  /**
   * Hands an expense to a different approver — the sanctioned way past a self-approval block
   * (US-CW-006 AC-08). Deliberately does NOT run canApprove: self-approval is only forbidden for the
   * *approve* action, and reassigning your own expense is precisely the escape hatch. Like reject, the
   * item leaves this approver's pending queue (the demo doesn't model who it routes to next). Still
   * gated on approvals:act so a role without approval authority can't reroute the queue.
   */
  reassign(itemId: string, actor: ApprovalActor): ApprovalSimpleOutcome {
    if (!hasPermission(actor.permissions, 'approvals:act')) {
      return { outcome: 'forbidden', reason: 'forbidden_role' };
    }
    const item = this.items.get(itemId);
    if (!item) return { outcome: 'not_found' };

    this.resolve(itemId, { action: 'reassigned', actedBy: actor.displayName }, actor.userId);
    return { outcome: 'ok', item: { ...item } };
  }

  /** The cached success for a previously-seen idempotency key, or undefined for a first-time key. */
  private replay(idempotencyKey?: string): ApprovalActionOutcome | undefined {
    if (!idempotencyKey) return undefined;
    const cached = this.idempotency.get(idempotencyKey);
    if (!cached) return undefined;
    // Deep-copy the item so a caller can't mutate cached state through the replayed reference.
    return cached.outcome === 'ok' ? { outcome: 'ok', item: { ...cached.item } } : cached;
  }

  /** Caches a committed outcome under its idempotency key so a retry replays it exactly once. */
  private remember(idempotencyKey: string | undefined, outcome: ApprovalActionOutcome): void {
    if (idempotencyKey) this.idempotency.set(idempotencyKey, outcome);
  }

  /** Records a per-employee notification for a committed approve/reject (US-CW-013 AC-04). */
  private notify(event: Omit<ApprovalNotification, 'timestamp'>): void {
    this.notifications.push({ ...event, timestamp: this.clock() });
  }

  /** Drops an item from the pending queue, remembers how it was resolved, and logs the audit event. */
  private resolve(itemId: string, resolution: ApprovalResolution, actorId: string): void {
    this.items.delete(itemId);
    this.resolved.set(itemId, resolution);
    this.auditLog.push({ itemId, action: resolution.action, actorId, timestamp: this.clock() });
  }

  /** An action on an absent item: 409 conflict if another approver already resolved it, else 404. */
  private missing(itemId: string): ApprovalActionOutcome {
    const resolution = this.resolved.get(itemId);
    if (resolution) return { outcome: 'conflict', actedBy: resolution.actedBy };
    return { outcome: 'not_found' };
  }
}
