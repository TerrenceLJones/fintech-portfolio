import type { ReactNode } from 'react';
import { Button, Icon, Text } from '@clearline/ui';

/** Consistent card chrome for every reconciliation panel — one border/padding definition, not five. */
export function PanelCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-cl-border bg-cl-surface rounded-xl border p-[18px]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Text as="div" size="label" weight="semibold" tone="default" className="mb-0">
          {title}
        </Text>
        {actions}
      </div>
      {children}
    </div>
  );
}

/**
 * Shimmer placeholder rows for a panel that's still loading — sized bars, never a flash of "$0.00" or
 * empty content, so a slow panel reads as loading rather than as zero.
 */
export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="cl-skeleton h-2.5 rounded" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}

/**
 * The scoped failure state for a single reconciliation panel: a warning glyph, the panel's name,
 * "This section couldn't load." and a Retry that re-fetches only this panel — isolated from siblings.
 */
export function PanelError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div
      className="border-cl-border bg-cl-surface flex min-h-[140px] flex-col items-center justify-center rounded-xl border p-[18px] text-center"
      role="alert"
    >
      <div className="bg-cl-neg-weak mb-3 flex h-9 w-9 items-center justify-center rounded-[10px]">
        <Icon name="triangle-alert" size={18} className="text-cl-neg" />
      </div>
      <Text as="div" size="label" weight="semibold" tone="default" className="mb-0.5">
        {title}
      </Text>
      <Text as="p" size="label" tone="muted" className="mb-3">
        This section couldn't load.
      </Text>
      <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
