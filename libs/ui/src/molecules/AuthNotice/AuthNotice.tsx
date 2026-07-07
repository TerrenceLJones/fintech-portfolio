import { Icon } from '../../foundations/Icon';
import type { IconName } from '@clearline/icons';
import { Button } from '../../atoms/Button';
import { Text } from '../../atoms/Text';

export type AuthNoticeTone = 'accent' | 'warning' | 'critical' | 'positive' | 'neutral';

const TONE_CLASSES: Record<AuthNoticeTone, { weakBg: string; fg: string }> = {
  accent: { weakBg: 'bg-cl-accent-weak', fg: 'text-cl-accent-text' },
  warning: { weakBg: 'bg-cl-warn-weak', fg: 'text-cl-warn' },
  critical: { weakBg: 'bg-cl-crit-weak', fg: 'text-cl-crit' },
  positive: { weakBg: 'bg-cl-pos-weak', fg: 'text-cl-pos' },
  neutral: { weakBg: 'bg-cl-surface-2', fg: 'text-cl-text-2' },
};

export interface AuthNoticeAction {
  label: string;
  onClick?: () => void;
}

export interface AuthNoticeProps {
  icon: IconName;
  tone?: AuthNoticeTone;
  title: string;
  description?: string;
  /** Rendered as a full-width Button, e.g. "Resend link". */
  primaryAction?: AuthNoticeAction;
  /** Rendered as a text link, e.g. "Back to sign in". */
  secondaryAction?: AuthNoticeAction;
}

/**
 * Centered icon-in-rounded-square notice used across the auth flows for single-message states
 * (check your email, link expired, signed out, session ended) — a Modal without the overlay,
 * for whenever the message *is* the page rather than an interruption of one.
 */
export function AuthNotice({
  icon,
  tone = 'accent',
  title,
  description,
  primaryAction,
  secondaryAction,
}: AuthNoticeProps) {
  const t = TONE_CLASSES[tone];

  return (
    <div className="text-center">
      <div
        className={`mx-auto mb-4 flex h-11.5 w-11.5 items-center justify-center rounded-xl ${t.weakBg}`}
      >
        <Icon name={icon} size={22} className={t.fg} />
      </div>
      <Text as="h3" size="heading" tone="default" className="mb-2">
        {title}
      </Text>
      {description ? (
        <Text as="p" size="label" weight="regular" tone="muted" className="mb-4.5">
          {description}
        </Text>
      ) : null}
      {primaryAction ? (
        <Button type="button" onClick={primaryAction.onClick} fullWidth>
          {primaryAction.label}
        </Button>
      ) : null}
      {secondaryAction ? (
        <Button variant="link" onClick={secondaryAction.onClick} className="mt-3.5">
          {secondaryAction.label}
        </Button>
      ) : null}
    </div>
  );
}
