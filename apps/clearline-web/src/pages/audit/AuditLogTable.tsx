import type { AuditDiff, AuditEvent } from '@clearline/contracts';
import { Icon, Text } from '@clearline/ui';

const DIFF_TO_TONE: Record<NonNullable<AuditDiff['tone']>, string> = {
  positive: 'text-cl-pos',
  warning: 'text-cl-warn',
  negative: 'text-cl-neg',
  neutral: 'text-cl-text-2',
};

/**
 * "2026-06-29T14:22:07.000Z" → "Jun 29 · 14:22:07 UTC". Pinned to UTC (not the viewer's zone) so an
 * audit timestamp is unambiguous and reproducible for anyone reading the log — an audit record's time
 * shouldn't shift by who's looking at it — and the "UTC" suffix makes the zone explicit.
 */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
  return `${day} · ${time} UTC`;
}

const COLS = 'grid grid-cols-[1.1fr_1fr_1.3fr_1.6fr] gap-3 px-4 py-2.5 items-center';

/** The before → after / detail cell — a diff renders struck-through "from" → toned "to"; else the detail string. */
function DiffCell({ event }: { event: AuditEvent }) {
  if (event.category === 'audit_access') {
    return (
      <span className="text-cl-accent-text inline-flex items-center gap-1.5 font-mono text-xs">
        <Icon name="eye" size={11} />
        access recorded
      </span>
    );
  }
  if (event.diff) {
    const tone = event.diff.tone ?? 'neutral';
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs">
        <span className="text-cl-text-3 line-through">{event.diff.from}</span>
        <Icon name="arrow-right" size={11} className="text-cl-text-3" />
        <span className={DIFF_TO_TONE[tone]}>{event.diff.to}</span>
      </span>
    );
  }
  return <span className="text-cl-text-2 font-mono text-xs">{event.detail ?? '—'}</span>;
}

export interface AuditLogTableProps {
  events: AuditEvent[];
  /** The signed-in user's id — their own access events are highlighted, mirroring the design's self-entry. */
  currentUserId?: string;
}

/**
 * The append-only audit log table (US-CW-021 §18): Timestamp · Actor · Action · Before → After. Each
 * row is one immutable event; `audit_access` events (viewing the log) read through a distinct
 * "access recorded" label, and the current viewer's own access rows are tinted so their self-audit is
 * visible at a glance — never conveyed by colour alone (the label carries it).
 */
export function AuditLogTable({ events, currentUserId }: AuditLogTableProps) {
  return (
    <div className="border-cl-border bg-cl-surface overflow-hidden rounded-xl border">
      <div
        className={`${COLS} bg-cl-inset border-cl-border text-cl-text-3 border-b font-mono text-[10.5px] font-semibold tracking-wide uppercase`}
      >
        <div>Timestamp</div>
        <div>Actor</div>
        <div>Action</div>
        <div>Before → After</div>
      </div>
      {events.map((event) => {
        const isSelfAccess = event.category === 'audit_access' && event.actor.id === currentUserId;
        return (
          <div
            key={event.id}
            className={`${COLS} border-cl-border border-b last:border-b-0 ${
              isSelfAccess ? 'bg-cl-accent-weak' : ''
            }`}
            data-category={event.category}
            data-self-access={isSelfAccess ? 'true' : undefined}
          >
            <Text as="div" size="mono" tone="faint" className="text-[11px]">
              {formatTimestamp(event.timestamp)}
            </Text>
            <Text as="div" size="label" weight={isSelfAccess ? 'semibold' : 'medium'}>
              {event.actor.name}
            </Text>
            <Text as="div" size="label" weight="regular">
              {event.action}
              {event.target ? (
                <span className="text-cl-text-3 ml-1.5 font-mono text-[10.5px]">
                  {event.target.label}
                </span>
              ) : null}
            </Text>
            <div>
              <DiffCell event={event} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
