import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '@fintech-portfolio/icons';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-cl-accent text-white',
  secondary: 'bg-cl-surface text-cl-text border border-cl-border-2',
  ghost: 'bg-transparent text-cl-accent-text',
  danger: 'bg-cl-surface text-cl-neg border border-cl-border-2',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-[13px]',
  lg: 'px-4.5 py-3 text-sm',
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 13, md: 14, lg: 15 };

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  label?: string;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  fullWidth = false,
  label,
  children,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = !!disabled;
  const look = isDisabled
    ? 'bg-cl-surface-2 text-cl-text-3 cursor-not-allowed'
    : VARIANT_CLASSES[variant];

  return (
    <button
      type="button"
      disabled={isDisabled || loading}
      className={[
        'font-sans font-semibold leading-none rounded-lg',
        fullWidth ? 'flex w-full' : 'inline-flex',
        'items-center justify-center gap-1.5 whitespace-nowrap',
        !isDisabled && !loading && 'cursor-pointer',
        loading && 'opacity-80',
        SIZE_CLASSES[size],
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
