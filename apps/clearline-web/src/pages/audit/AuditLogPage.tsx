import { AccessDenied, EmptyState, Icon, Text } from '@clearline/ui';
import { AuditForbiddenError, useAuditLog } from '@clearline/data-access-audit';
import { useSession } from '@clearline/data-access-auth';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { usePageTitle } from '../../hooks/usePageTitle';
import { auditLogBeacon } from './AuditLogPage.beacon';
import { AuditLogTable } from './AuditLogTable';

/** The immutable "Append-only · cannot be edited or deleted" assurance badge from the design (§18). */
function AppendOnlyBadge() {
  return (
    <span className="text-cl-text-2 bg-cl-surface-2 border-cl-border-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10.5px] font-semibold">
      <Icon name="lock" size={11} />
      Append-only · cannot be edited or deleted
    </span>
  );
}

function LogSkeleton() {
  return (
    <div className="border-cl-border bg-cl-surface overflow-hidden rounded-xl border" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border-cl-border flex gap-3 border-b px-4 py-3.5 last:border-b-0">
          <div className="cl-skeleton h-4 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

/**
 * The immutable, append-only audit log (US-CW-021, §18). Controller/Admin only — a 403 degrades to
 * access-denied rather than a limited view (AC-06). Opening this view is itself an audited action: the
 * server records the access before returning, so the freshly-recorded "Viewed audit log" event is the
 * first row the viewer sees, tinted as their own self-audit. The log carries who / what / when with a
 * before → after diff for card-control and role/permission changes; nothing here can edit or delete a
 * record — corrections are only ever appended (AC-05).
 */
export function AuditLogPage() {
  usePageTitle('Audit Log');
  useDemoBeacon(auditLogBeacon);

  const log = useAuditLog();
  const session = useSession();

  if (log.error instanceof AuditForbiddenError) {
    return <AccessDenied requestLine="403 Forbidden · GET /api/audit-log" />;
  }

  const events = log.data?.events ?? [];

  return (
    <div className="font-sans">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Text as="h2" size="heading" tone="default" className="mb-0">
            Audit log
          </Text>
          <AppendOnlyBadge />
        </div>
        {session.data ? (
          <Text as="span" size="label" tone="faint" className="mb-0">
            {session.data.displayName} · {session.data.role.replace('_', ' ')}
          </Text>
        ) : null}
      </div>

      <Text as="p" size="label" tone="muted" className="mb-4 max-w-2xl">
        Every financial action — payments, approvals, card-control changes, and role changes — is
        recorded here with a before → after diff. Opening this view is itself logged. Even admins
        can't alter or remove entries; corrections are appended as new events.
      </Text>

      {log.isError ? (
        <div role="alert">
          <EmptyState
            icon="triangle-alert"
            title="The audit log couldn't load"
            body="Please try again."
            action="Retry"
            onAction={() => void log.refetch()}
          />
        </div>
      ) : log.isPending ? (
        <LogSkeleton />
      ) : events.length === 0 ? (
        <EmptyState
          icon="clock"
          title="No audit events yet"
          body="Financial actions across the platform will appear here as they happen."
        />
      ) : (
        <AuditLogTable events={events} currentUserId={session.data?.userId} />
      )}
    </div>
  );
}
