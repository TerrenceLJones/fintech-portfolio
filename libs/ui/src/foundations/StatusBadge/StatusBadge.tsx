import { Icon } from '../Icon';
import type { IconName } from '@clearline/icons';
import { Text } from '../../atoms/Text';

export type StatusKey =
  | 'draft'
  | 'pending-l1'
  | 'pending-l2'
  | 'approved'
  | 'paid'
  | 'reconciled'
  | 'rejected'
  | 'reversed'
  | 'frozen'
  | 'under-review';

type Tone = 'positive' | 'negative' | 'warning' | 'pending' | 'paid' | 'reconciled' | 'neutral';

interface StatusDefinition {
  icon: IconName;
  label: string;
  tone: Tone;
}

// status -> glyph + label + tone. The single mapping every surface shares —
// status is never conveyed by color alone.
const STATUS: Record<StatusKey, StatusDefinition> = {
  draft: { icon: 'pencil', label: 'Draft', tone: 'neutral' },
  'pending-l1': { icon: 'clock', label: 'Pending L1', tone: 'pending' },
  'pending-l2': { icon: 'clock', label: 'Pending L2', tone: 'warning' },
  approved: { icon: 'check', label: 'Approved', tone: 'positive' },
  paid: { icon: 'arrow-right-circle', label: 'Paid', tone: 'paid' },
  reconciled: { icon: 'double-check', label: 'Reconciled', tone: 'reconciled' },
  rejected: { icon: 'x-circle', label: 'Rejected', tone: 'negative' },
  reversed: { icon: 'arrow-left', label: 'Reversed', tone: 'warning' },
  frozen: { icon: 'snowflake', label: 'Frozen', tone: 'neutral' },
  'under-review': { icon: 'clock', label: 'Under review', tone: 'pending' },
};

const TONE_CLASSES: Record<Tone, string> = {
  positive: 'bg-cl-pos-weak text-cl-pos',
  negative: 'bg-cl-neg-weak text-cl-neg',
  warning: 'bg-cl-warn-weak text-cl-warn',
  pending: 'bg-cl-pending-weak text-cl-pending',
  paid: 'bg-cl-paid-weak text-cl-paid',
  reconciled: 'bg-cl-recon-weak text-cl-recon',
  neutral: 'bg-cl-surface-2 text-cl-text-2 border border-cl-border-2',
};

export interface StatusBadgeProps {
  status: StatusKey;
  /** Overrides the status's default label text. */
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const def = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 leading-none whitespace-nowrap ${TONE_CLASSES[def.tone]}`}
    >
      <Icon name={def.icon} size={12} />
      <Text as="span" size="label" weight="semibold">
        {label ?? def.label}
      </Text>
    </span>
  );
}
