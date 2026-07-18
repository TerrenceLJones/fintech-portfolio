import type { AuditEvent } from '@clearline/contracts';
import { SEED_AUDIT_EVENTS } from '../fixtures/audit.fixture';

/**
 * What a caller supplies to `record` — a full event minus the fields the store owns. `id` is always
 * generated; `timestamp` defaults to the service clock but may be supplied for a back-dated event.
 */
export type AuditEventInput = Omit<AuditEvent, 'id' | 'timestamp'> & { timestamp?: string };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * The central, immutable, append-only audit store for US-CW-021 — the single mechanism payments,
 * approvals, card controls, and admin role-management flows emit to, rather than each keeping its own
 * log. It deliberately exposes ONLY `record` (append) and `list` (read): there is no update, delete,
 * or clear method at this layer, so no caller — UI, handler, or admin tool — can alter or remove a
 * written event (AC-05). Corrections are appended as new events, never edits. `list` returns deep
 * clones newest-first, so even the returned array can't be used to mutate stored history. State is
 * per-instance; the app binds the shared singleton and tests inject a fixed-clock instance.
 */
export class AuditService {
  private readonly events: AuditEvent[];
  private readonly now: () => number;
  private seq = 0;

  constructor(
    seed: readonly AuditEvent[] = SEED_AUDIT_EVENTS,
    now: () => number = () => Date.now(),
  ) {
    this.events = seed.map((event) => clone(event));
    this.now = now;
  }

  /** Append a new event. Returns a clone of the stored record (with its generated id + timestamp). */
  record(input: AuditEventInput): AuditEvent {
    const event: AuditEvent = {
      ...clone(input),
      id: `audit_evt_${++this.seq}_${this.now()}`,
      timestamp: input.timestamp ?? new Date(this.now()).toISOString(),
    };
    this.events.push(event);
    return clone(event);
  }

  /**
   * The full log, newest-first. Deep-cloned so history can't be mutated through the result. Ties on
   * timestamp are broken by insertion order (later-appended first) so a burst of events recorded in
   * the same millisecond — e.g. the per-change events a bulk approve/reject produces — still reads
   * newest-first rather than falling back to an arbitrary order.
   */
  list(): AuditEvent[] {
    return this.events
      .map((event, index) => ({ event, index }))
      .sort((a, b) => {
        if (a.event.timestamp !== b.event.timestamp) {
          return a.event.timestamp < b.event.timestamp ? 1 : -1;
        }
        return b.index - a.index;
      })
      .map(({ event }) => clone(event));
  }
}
