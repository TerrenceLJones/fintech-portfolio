import type { Integration, IntegrationStatus } from '@clearline/contracts';
import type { IconName } from '@clearline/icons';
import { Icon } from '../../foundations/Icon';
import { Button } from '../../atoms/Button';

interface StatusDef {
  icon: IconName;
  label: string;
  className: string;
  spin?: boolean;
}

/**
 * The four IntegrationCard connection states (design §19.8). Status is never conveyed by colour alone
 * (design §19 intro / US-CW-020) — each state pairs a glyph with a text label. `syncing` is the
 * transient state shown while a Sync-now request is in flight (driven by the `syncing` prop, since the
 * server only ever returns a completed connection).
 */
const STATUS: Record<IntegrationStatus, StatusDef> = {
  connected: { icon: 'check', label: 'Connected', className: 'bg-cl-pos-weak text-cl-pos' },
  syncing: {
    icon: 'spinner',
    label: 'Syncing…',
    className: 'bg-cl-pending-weak text-cl-pending',
    spin: true,
  },
  error: { icon: 'triangle-alert', label: 'Error', className: 'bg-cl-neg-weak text-cl-neg' },
  disconnected: {
    icon: 'minus',
    label: 'Disconnected',
    className: 'bg-cl-surface-2 text-cl-text-3',
  },
};

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const def = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${def.className}`}
    >
      <Icon name={def.icon} size={11} className={def.spin ? 'animate-spin' : undefined} />
      {def.label}
    </span>
  );
}

export interface IntegrationCardProps {
  integration: Integration;
  /** Monospace provider initials shown in the glyph, e.g. "QB" (from the domain catalogue). */
  initials: string;
  /** Human "Last synced …" label the page formats from `integration.lastSyncAt`. */
  lastSyncLabel?: string;
  /** True while a Sync-now request is in flight — renders the transient Syncing… state (AC-03). */
  syncing?: boolean;
  onConnect?: () => void;
  onSyncNow?: () => void;
  onConfigureMapping?: () => void;
  onViewSyncLog?: () => void;
  onReconnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * A single accounting-provider connection card (US-CW-039, design §19.8). Presentational: it renders
 * the provider identity, the status badge, and the state-appropriate actions, raising intent through
 * callbacks — the page owns the OAuth/mapping/sync/disconnect flows and the data. The effective status
 * is `syncing` while a sync is in flight, otherwise the server's connection status.
 */
export function IntegrationCard({
  integration,
  initials,
  lastSyncLabel,
  syncing = false,
  onConnect,
  onSyncNow,
  onConfigureMapping,
  onViewSyncLog,
  onReconnect,
  onDisconnect,
}: IntegrationCardProps) {
  const status: IntegrationStatus = syncing ? 'syncing' : integration.status;

  return (
    <div className="rounded-xl border border-cl-border bg-cl-surface p-5">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-cl-border bg-cl-inset font-mono text-[11px] font-bold text-cl-text-2">
            {initials}
          </div>
          <div>
            <div className="text-sm font-semibold text-cl-text">{integration.name}</div>
            <div className="text-[11.5px] text-cl-text-2">
              {integration.accountEmail ?? (status === 'disconnected' ? 'Not connected' : '')}
            </div>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {status === 'error' ? (
        <div className="mb-3.5 flex items-start gap-2 rounded-lg border border-cl-neg bg-cl-neg-weak px-3 py-2.5">
          <Icon name="info" size={13} className="mt-0.5 shrink-0 text-cl-neg" />
          <span className="text-[11.5px] leading-snug text-cl-text">
            {integration.errorMessage ??
              'Last sync failed — the connection may need to be refreshed.'}
          </span>
        </div>
      ) : status === 'disconnected' ? (
        <div className="mb-3.5 text-[11.5px] leading-snug text-cl-text-2">
          Connect {integration.name} to sync expense categories to GL accounts automatically.
        </div>
      ) : (
        <div className="mb-3.5 text-[11.5px] text-cl-text-3">
          {status === 'syncing'
            ? 'Syncing transactions…'
            : lastSyncLabel && (
                <>
                  Last synced <span className="text-cl-text-2">{lastSyncLabel}</span>
                </>
              )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status === 'disconnected' && (
          <Button variant="secondary" size="sm" icon="plus" onClick={onConnect}>
            Connect
          </Button>
        )}

        {status === 'error' && (
          <>
            <Button variant="primary" size="sm" icon="refresh" onClick={onReconnect}>
              Reconnect
            </Button>
            <Button variant="secondary" size="sm" onClick={onSyncNow}>
              Sync now
            </Button>
          </>
        )}

        {(status === 'connected' || status === 'syncing') && (
          <>
            <Button
              variant="primary"
              size="sm"
              icon="refresh"
              loading={syncing}
              disabled={syncing}
              onClick={onSyncNow}
            >
              Sync now
            </Button>
            <Button variant="secondary" size="sm" onClick={onConfigureMapping}>
              Configure GL mapping
            </Button>
            <Button variant="secondary" size="sm" onClick={onViewSyncLog}>
              View sync log
            </Button>
            <Button variant="secondary" size="sm" className="ml-auto" onClick={onDisconnect}>
              Disconnect
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
