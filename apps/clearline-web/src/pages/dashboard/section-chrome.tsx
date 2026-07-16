import type { ReactNode } from 'react';
import { Text } from '@clearline/ui';

/** Consistent card chrome for every dashboard section — one border/padding definition, not five. */
export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-cl-border bg-cl-surface rounded-xl border p-[18px]">
      <Text as="div" size="label" weight="semibold" tone="default" className="mb-4">
        {title}
      </Text>
      {children}
    </div>
  );
}

/**
 * Shimmer placeholder rows for a section that's still loading. Sized bars — never a flash of "$0.00"
 * or empty content — so a slow section reads as loading, not as zero spend (US-CW-015 AC-01).
 */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="cl-skeleton h-2.5 rounded" style={{ width: `${100 - i * 15}%` }} />
      ))}
    </div>
  );
}
