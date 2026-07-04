import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '@fintech-portfolio/icons';
import { useDisabledGuard } from '../../utils/useDisabledGuard';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';
/** Overrides a `primary`/`secondary` button's color to match a status/alert tone instead of the default accent look. */
export type ButtonTone = 'accent' | 'positive' | 'negative' | 'warning' | 'critical' | 'neutral';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-cl-accent text-white',
  secondary: 'bg-cl-surface text-cl-text border border-cl-border-2',
  ghost: 'bg-transparent text-cl-accent-text',
  danger: 'bg-cl-surface text-cl-neg border border-cl-border-2',
  // No box at all — see the `isLink` branching below, which also skips SIZE_CLASSES' padding and
  // font-semibold/rounded-lg so this renders as plain inline text, not a shrunken box variant.
  link: 'bg-transparent text-cl-accent-text',
};

const SOLID_TONE_CLASSES: Record<ButtonTone, string> = {
  accent: 'bg-cl-accent',
  positive: 'bg-cl-pos',
  negative: 'bg-cl-neg',
  warning: 'bg-cl-warn',
  critical: 'bg-cl-crit',
  neutral: 'bg-cl-text-3',
};

const BORDERED_TONE_TEXT_CLASSES: Record<ButtonTone, string> = {
  accent: 'text-cl-accent-text',
  positive: 'text-cl-pos',
  negative: 'text-cl-neg',
  warning: 'text-cl-warn',
  critical: 'text-cl-crit',
  neutral: 'text-cl-text-2',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-[13px]',
  lg: 'px-4.5 py-3 text-sm',
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 13, md: 14, lg: 15 };

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  label?: string;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  tone,
  size = 'md',
  icon,
  loading = false,
  fullWidth = false,
  label,
  children,
  disabled,
  className,
  onClick,
  ...rest
}: ButtonProps) {
  const isDisabled = !!disabled;
  // `link` renders as bare inline text (no padding/border/background) rather than a box, so its
  // disabled/enabled looks skip the box-only classes (background, border) the other variants use.
  const isLink = variant === 'link';
  let look: string;
  if (isDisabled) {
    look = isLink
      ? 'text-cl-text-3 cursor-not-allowed'
      : 'bg-cl-surface-2 text-cl-text-3 cursor-not-allowed';
  } else if (isLink) {
    look = VARIANT_CLASSES.link;
  } else if (tone && variant === 'primary') {
    look = `${SOLID_TONE_CLASSES[tone]} text-white`;
  } else if (tone && variant === 'secondary') {
    look = `bg-cl-surface border border-cl-border-2 ${BORDERED_TONE_TEXT_CLASSES[tone]}`;
  } else {
    look = VARIANT_CLASSES[variant];
  }

  const guard = useDisabledGuard(isDisabled || loading, onClick);

  return (
    <button
      type="button"
      aria-disabled={guard['aria-disabled']}
      aria-busy={loading}
      onClick={guard.onClick}
      className={[
        'font-sans leading-none',
        isLink ? 'font-medium text-[12.5px]' : 'font-semibold rounded-lg',
        fullWidth ? 'flex w-full' : 'inline-flex',
        'items-center justify-center gap-1.5 whitespace-nowrap',
        !isDisabled && !loading && 'cursor-pointer',
        loading && 'cursor-not-allowed opacity-80',
        isLink ? 'p-0 border-none' : SIZE_CLASSES[size],
        look,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading ? (
        <Icon name="spinner" size={ICON_SIZE[size]} className="animate-spin" />
      ) : icon ? (
        <Icon name={icon} size={ICON_SIZE[size]} />
      ) : null}
      <span>{children ?? label ?? 'Button'}</span>
    </button>
  );
}
