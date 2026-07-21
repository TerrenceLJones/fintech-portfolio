import type { ConnectionStatus } from '@clearline/contracts';
import { Icon } from '@clearline/ui';
import type { IconName } from '@clearline/icons';

interface StatusDef {
  icon: IconName;
  label: string;
  className: string;
}

/**
 * Connection status as a glyph + text pill (US-CW-038). Status is never conveyed by colour alone
 * (design §19 intro), so each state pairs an icon with a label. Distinct from the finance-flow
 * StatusBadge, whose fixed vocabulary doesn't cover bank-connection states.
 */
const STATUS: Record<ConnectionStatus, StatusDef> = {
  connected: { icon: 'check', label: 'Connected', className: 'bg-cl-pos-weak text-cl-pos' },
  pending_verification: {
    icon: 'clock',
    label: 'Verification pending',
    className: 'bg-cl-pending-weak text-cl-pending',
  },
  reconnect_required: {
    icon: 'triangle-alert',
    label: 'Reconnect needed',
    className: 'bg-cl-warn-weak text-cl-warn',
  },
  verification_locked: {
    icon: 'x-circle',
    label: 'Verification locked',
    className: 'bg-cl-neg-weak text-cl-neg',
  },
};

export function AccountStatusBadge({ status }: { status: ConnectionStatus }) {
  const def = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${def.className}`}
    >
      <Icon name={def.icon} size={11} />
      {def.label}
    </span>
  );
}
