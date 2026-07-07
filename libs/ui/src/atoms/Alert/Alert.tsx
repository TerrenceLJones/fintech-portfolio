import type { ReactNode } from 'react';
import { Icon } from '../../foundations/Icon';
import type { IconName } from '@clearline/icons';
import { Button, type ButtonTone } from '../Button';
import { Text } from '../Text';

export type AlertTone = 'info' | 'positive' | 'warning' | 'negative' | 'critical' | 'neutral';

interface ToneDef {
  fgClass: string;
  weakBgClass: string;
  buttonTone: ButtonTone;
  icon: IconName;
}

const TONE: Record<AlertTone, ToneDef> = {
  info: {
    fgClass: 'text-cl-accent-text',
    weakBgClass: 'bg-cl-accent-weak',
    buttonTone: 'accent',
    icon: 'info',
  },
  positive: {
    fgClass: 'text-cl-pos',
    weakBgClass: 'bg-cl-pos-weak',
    buttonTone: 'positive',
    icon: 'check',
  },
  warning: {
    fgClass: 'text-cl-warn',
    weakBgClass: 'bg-cl-warn-weak',
    buttonTone: 'warning',
    icon: 'triangle-alert',
  },
  negative: {
    fgClass: 'text-cl-neg',
    weakBgClass: 'bg-cl-neg-weak',
    buttonTone: 'negative',
    icon: 'x-circle',
  },
  critical: {
    fgClass: 'text-cl-crit',
    weakBgClass: 'bg-cl-crit-weak',
    buttonTone: 'critical',
    icon: 'octagon-alert',
  },
  neutral: {
    fgClass: 'text-cl-text-2',
    weakBgClass: 'bg-cl-inset',
    buttonTone: 'neutral',
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
        <div>
          <Text size="label" weight="semibold" tone="default">
            {title}
          </Text>
          {message ? (
            <Text size="label" weight="regular" tone="muted">
              {message}
            </Text>
          ) : null}
        </div>
      </div>
      {action ? (
        <Button
          variant="primary"
          tone={def.buttonTone}
          size="sm"
          onClick={onAction}
          className="flex-shrink-0"
        >
          {action}
        </Button>
      ) : null}
    </div>
  );
}
