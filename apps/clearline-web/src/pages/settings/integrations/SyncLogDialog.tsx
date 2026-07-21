import { Icon, Modal, Text } from '@clearline/ui';
import type { IconName } from '@clearline/icons';
import type { IntegrationProvider, SyncLogEntry, SyncOutcome } from '@clearline/contracts';
import { useSyncLog } from '@clearline/data-access-integrations';

export interface SyncLogDialogProps {
  provider: IntegrationProvider | null;
  providerName: string;
  onOpenChange: (open: boolean) => void;
}

const OUTCOME: Record<SyncOutcome, { icon: IconName; label: string; className: string }> = {
  success: { icon: 'check', label: 'Success', className: 'text-cl-pos' },
  partial: { icon: 'triangle-alert', label: 'Partial', className: 'text-cl-warn' },
  failed: { icon: 'x-circle', label: 'Failed', className: 'text-cl-neg' },
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function OutcomeCell({ entry }: { entry: SyncLogEntry }) {
  const def = OUTCOME[entry.outcome];
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${def.className}`}
      >
        <Icon name={def.icon} size={12} />
        {def.label}
      </span>
      {entry.detail && entry.outcome !== 'success' ? (
        <Text as="span" size="label" tone="faint">
          {entry.detail}
        </Text>
      ) : null}
    </div>
  );
}

/**
 * The provider's sync-log history (US-CW-039 AC-05): Date/Time, Records Synced, Status
 * (Success / Partial / Failed) with a details line for failed or partial runs. Status is icon + text,
 * never colour alone.
 */
export function SyncLogDialog({ provider, providerName, onOpenChange }: SyncLogDialogProps) {
  const open = provider !== null;
  const query = useSyncLog(provider ?? 'quickbooks', open);
  const entries = query.data?.entries ?? [];

  return (
    <Modal open={open} onOpenChange={onOpenChange} maxWidth={560}>
      <Modal.Title asChild>
        <Text as="h2" size="heading" weight="semibold" className="mb-1">
          {providerName} sync log
        </Text>
      </Modal.Title>

      <div className="border-cl-border mt-4 overflow-hidden rounded-lg border">
        <div className="bg-cl-inset border-cl-border text-cl-text-3 grid grid-cols-[1.4fr_0.8fr_1.2fr] gap-3 border-b px-4 py-2.5 font-mono text-[10px] uppercase tracking-wide">
          <div>Date / Time</div>
          <div>Records</div>
          <div>Status</div>
        </div>
        {entries.length === 0 ? (
          <Text as="p" size="label" tone="muted" className="px-4 py-4">
            No syncs yet.
          </Text>
        ) : (
          entries.map((entry, index) => (
            <div
              key={entry.id}
              className={`border-cl-border grid grid-cols-[1.4fr_0.8fr_1.2fr] items-center gap-3 px-4 py-3 text-[12.5px] ${
                index > 0 ? 'border-t' : ''
              }`}
            >
              <div className="font-mono text-cl-text-2">{formatTimestamp(entry.timestamp)}</div>
              <div className="font-mono">{entry.recordsSynced}</div>
              <OutcomeCell entry={entry} />
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
