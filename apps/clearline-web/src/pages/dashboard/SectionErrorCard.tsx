import { Button, Icon, Text } from '@clearline/ui';

export interface SectionErrorCardProps {
  /** The section's name, so the failure is attributable ("Top vendors couldn't load"). */
  title: string;
  onRetry: () => void;
}

/**
 * The scoped failure state for a single dashboard section (US-CW-015 AC-05): a warning glyph, the
 * section's name, "This section couldn't load." and a Retry that re-fetches only this section. Used
 * both by a section's own query-error branch and as the SectionErrorBoundary fallback, so a data
 * failure and an unexpected render error present identically — and neither touches its siblings.
 */
export function SectionErrorCard({ title, onRetry }: SectionErrorCardProps) {
  return (
    <div
      className="border-cl-border bg-cl-surface flex min-h-[172px] flex-col items-center justify-center rounded-xl border p-[18px] text-center"
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
