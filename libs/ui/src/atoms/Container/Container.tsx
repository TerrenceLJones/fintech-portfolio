import type { ReactNode } from 'react';

export type ContainerWidth = 'sm' | 'lg';

// Component-owned width scale, independent of Tailwind's own max-w-* steps: 'sm' preserves
// AuthLayout's original form-column width, 'lg' preserves AppShell's original default content
// width. Callers with a one-off requirement (AppShell.maxWidth) can still pass an exact pixel
// number instead of a named token.
const NAMED_WIDTHS: Record<ContainerWidth, number> = {
  sm: 384,
  lg: 1200,
};

export interface ContainerProps {
  /** A named width token, or an exact pixel value for one-off cases. */
  width?: ContainerWidth | number;
  /** Horizontally centers the container within its parent via `mx-auto`. */
  center?: boolean;
  /** Applies the standard horizontal page padding. */
  padded?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Shared max-width primitive for page-level layouts (AppShell's content column, AuthLayout's
 * form column) so consistent widths and padding live in one place instead of being hand-rolled
 * per layout.
 */
export function Container({
  width = 'lg',
  center = true,
  padded = true,
  className,
  children,
}: ContainerProps) {
  const maxWidth = typeof width === 'number' ? width : NAMED_WIDTHS[width];
  const classes = ['w-full', center && 'mx-auto', padded && 'px-8', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={{ maxWidth }}>
      {children}
    </div>
  );
}
