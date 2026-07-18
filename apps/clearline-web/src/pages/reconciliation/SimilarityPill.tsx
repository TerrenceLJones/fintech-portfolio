import { Icon, Text } from '@clearline/ui';

/**
 * The accent-tinted score pill the design uses for a fuzzy suggestion — e.g. "92% match". The literal
 * percentage carries the meaning and a `sparkles` glyph marks it as a fuzzy/suggested match, so the
 * cue is spelled out in icon + text and colour only reinforces it (never colour alone — US-CW-020
 * AC-01). Distinct from StatusBadge because it shows a number rather than a fixed status label.
 */
export function SimilarityPill({ percent, label = 'match' }: { percent: number; label?: string }) {
  return (
    <span className="bg-cl-accent-weak text-cl-accent-text inline-flex items-center gap-1 rounded-md px-2.5 py-1 whitespace-nowrap">
      <Icon name="sparkles" size={12} />
      <Text as="span" size="label" weight="semibold" className="text-cl-accent-text">
        {percent}% {label}
      </Text>
    </span>
  );
}
