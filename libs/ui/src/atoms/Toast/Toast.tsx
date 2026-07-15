import type { IconName } from '@clearline/icons';
import { Icon } from '../../foundations/Icon';
import { Text } from '../Text';

export type ToastTone = 'positive' | 'neutral' | 'negative';

interface ToneDef {
  iconClass: string;
  icon: IconName;
}

const TONE: Record<ToastTone, ToneDef> = {
  positive: { iconClass: 'text-cl-pos', icon: 'check' },
  neutral: { iconClass: 'text-cl-text-3', icon: 'info' },
  negative: { iconClass: 'text-cl-neg', icon: 'x-circle' },
};

export interface ToastProps {
  /** The short confirmation message, e.g. "10 approved". */
  message: string;
  /** Drives the leading glyph + its color; defaults to positive (a green check). */
  tone?: ToastTone;
  /** Override the tone's default glyph. */
  icon?: IconName;
  /**
   * `status` (default) announces politely for confirmations; `alert` interrupts for the rare
   * failure toast. Either way the message is spoken — meaning is never carried by color alone.
   */
  role?: 'status' | 'alert';
}

/**
 * A transient dark pill for a one-line confirmation of a completed action — e.g. the "10 approved"
 * batch-success toast (US-CW-013 AC-01, design §7.2). Presentational: the caller controls when it
 * appears and dismisses it. Pairs an icon with its color so the outcome reads without relying on hue.
 */
export function Toast({ message, tone = 'positive', icon, role = 'status' }: ToastProps) {
  const def = TONE[tone];

  return (
    <div
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      className="bg-cl-text inline-flex items-center gap-2.5 rounded-lg px-4.5 py-2.75 font-sans shadow-lg"
    >
      <span className={`${def.iconClass} flex-shrink-0`}>
        <Icon name={icon ?? def.icon} size={16} />
      </span>
      <Text as="span" size="label" weight="semibold" tone="default" className="text-cl-surface">
        {message}
      </Text>
    </div>
  );
}
