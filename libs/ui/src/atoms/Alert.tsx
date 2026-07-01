import type { ReactNode } from 'react';
import { Icon, type IconName } from '@fintech-portfolio/icons';

export type AlertTone = 'info' | 'positive' | 'warning' | 'negative' | 'critical' | 'neutral';

interface ToneDef {
  fgClass: string;
  weakBgClass: string;
  solidBgClass: string;
  icon: IconName;
}

const TONE: Record<AlertTone, ToneDef> = {
  info: {
    fgClass: 'text-cl-accent-text',
    weakBgClass: 'bg-cl-accent-weak',
    solidBgClass: 'bg-cl-accent',
    icon: 'info',
  },
  positive: {
    fgClass: 'text-cl-pos',
    weakBgClass: 'bg-cl-pos-weak',
    solidBgClass: 'bg-cl-pos',
    icon: 'check',
  },
  warning: {
    fgClass: 'text-cl-warn',
    weakBgClass: 'bg-cl-warn-weak',
    solidBgClass: 'bg-cl-warn',
    icon: 'triangle-alert',
  },
  negative: {
    fgClass: 'text-cl-neg',
    weakBgClass: 'bg-cl-neg-weak',
    solidBgClass: 'bg-cl-neg',
    icon: 'x-circle',
  },
  critical: {
    fgClass: 'text-cl-crit',
    weakBgClass: 'bg-cl-crit-weak',
    solidBgClass: 'bg-cl-crit',
    icon: 'octagon-alert',
  },
  neutral: {
    fgClass: 'text-cl-text-2',
    weakBgClass: 'bg-cl-inset',
    solidBgClass: 'bg-cl-text-3',
    icon: 'info',
  },
};

export interface AlertProps {
  tone?: AlertTone;
  title: string;
  message?: ReactNode;
  action?: string;
  onAction?: () => void;
  icon?: IconName;
}

export function Alert({ tone = 'info', title, message, action, onAction, icon }: AlertProps) {
  const def = TONE[tone];

  return (
    <div className="border-cl-border flex items-center gap-3 rounded-lg border p-3.5 font-sans">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span className={`${def.fgClass} mt-0.5 flex-shrink-0`}>
          <Icon name={icon ?? def.icon} size={16} />
        </span>
        <div className="text-[12.5px] leading-relaxed">
          <div className="text-cl-text font-semibold">{title}</div>
          {message ? <div className="text-cl-text-2">{message}</div> : null}
        </div>
      </div>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className={`flex-shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold text-white ${def.solidBgClass}`}
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}
