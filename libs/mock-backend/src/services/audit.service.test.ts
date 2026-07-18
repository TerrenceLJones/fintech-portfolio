import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '@clearline/contracts';
import { AuditService } from './audit.service';

const SEED: AuditEvent[] = [
  {
    id: 'seed_a',
    timestamp: '2026-06-01T10:00:00.000Z',
    actor: { id: 'user_1', name: 'Marcus Okafor', role: 'finance_manager' },
    category: 'approval',
    action: 'Approved expense',
    target: { label: 'exp-1' },
    diff: { from: 'Pending L1', to: 'Approved', tone: 'positive' },
  },
  {
    id: 'seed_b',
    timestamp: '2026-06-02T10:00:00.000Z',
    actor: { id: 'user_3', name: 'Sofia Whitman', role: 'controller' },
    category: 'card_control',
    action: 'Froze card',
    target: { label: '•••• 5567' },
    diff: { from: 'Active', to: 'Frozen' },
  },
];

/** A fixed clock so appended timestamps are deterministic in tests. */
function fixedClock(iso: string) {
  return () => new Date(iso).getTime();
}

describe('AuditService', () => {
  it('lists the seeded events newest-first', () => {
    const service = new AuditService(SEED);
    const events = service.list();
    expect(events.map((e) => e.id)).toEqual(['seed_b', 'seed_a']);
  });

  it('returns clones so a caller cannot mutate the stored log', () => {
    const service = new AuditService(SEED);
    const first = service.list();
    first[0]!.action = 'TAMPERED';
    (first[0]!.diff as { to: string }).to = 'TAMPERED';
    const second = service.list();
    expect(second[0]!.action).toBe('Froze card');
    expect(second[0]!.diff?.to).toBe('Frozen');
  });

  it('appends a recorded event with a generated id and the clock timestamp, newest-first', () => {
    const service = new AuditService(SEED, fixedClock('2026-06-03T12:00:00.000Z'));
    const recorded = service.record({
      actor: { id: 'user_3', name: 'Sofia Whitman', role: 'controller' },
      category: 'audit_access',
      action: 'Viewed audit log',
    });
    expect(recorded.id).toBeTruthy();
    expect(recorded.timestamp).toBe('2026-06-03T12:00:00.000Z');

    const events = service.list();
    expect(events).toHaveLength(3);
    expect(events[0]!.id).toBe(recorded.id);
    expect(events[0]!.action).toBe('Viewed audit log');
  });

  it('honours an explicit timestamp on a recorded event over the clock', () => {
    const service = new AuditService(SEED, fixedClock('2026-06-03T12:00:00.000Z'));
    const recorded = service.record({
      actor: { id: 'user_1', name: 'Marcus Okafor', role: 'finance_manager' },
      category: 'payment',
      action: 'Submitted payment',
      timestamp: '2026-05-01T00:00:00.000Z',
    });
    expect(recorded.timestamp).toBe('2026-05-01T00:00:00.000Z');
    // Older than every seed event, so it sorts to the bottom.
    expect(service.list().at(-1)?.id).toBe(recorded.id);
  });

  it('orders same-timestamp events newest-appended-first (bulk-change tie-break)', () => {
    const service = new AuditService([], fixedClock('2026-06-03T12:00:00.000Z'));
    const first = service.record({
      actor: { id: 'user_1', name: 'Marcus Okafor', role: 'finance_manager' },
      category: 'approval',
      action: 'Approved expense exp-1',
    });
    const second = service.record({
      actor: { id: 'user_1', name: 'Marcus Okafor', role: 'finance_manager' },
      category: 'approval',
      action: 'Approved expense exp-2',
    });
    // Both share the fixed-clock timestamp; the later-appended event must sort first.
    expect(service.list().map((e) => e.id)).toEqual([second.id, first.id]);
  });

  it('generates unique ids across successive records', () => {
    const service = new AuditService([], fixedClock('2026-06-03T12:00:00.000Z'));
    const a = service.record({
      actor: { id: 'user_1', name: 'Marcus Okafor', role: 'finance_manager' },
      category: 'approval',
      action: 'Approved expense',
    });
    const b = service.record({
      actor: { id: 'user_1', name: 'Marcus Okafor', role: 'finance_manager' },
      category: 'approval',
      action: 'Rejected expense',
    });
    expect(a.id).not.toBe(b.id);
  });

  it('exposes no update or delete code path — the log is append-only (AC-05)', () => {
    const service = new AuditService(SEED) as unknown as Record<string, unknown>;
    for (const forbidden of ['update', 'delete', 'remove', 'edit', 'clear', 'set']) {
      expect(typeof service[forbidden]).toBe('undefined');
    }
  });
});
