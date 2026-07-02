import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { typography } from '@fintech-portfolio/design-tokens';

export type TextSize = keyof typeof typography.scale;
export type TextWeight = 'regular' | 'medium' | 'semibold';
export type TextTone =
  | 'default'
  | 'muted'
  | 'faint'
  | 'accent'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'critical';
export type TextElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'label' | 'div';

export interface TextProps extends Omit<ComponentPropsWithoutRef<'span'>, 'color'> {
  /** Maps 1:1 to a step in design-tokens' `typography.scale`. @default 'body' */
  size?: TextSize;
  /** Overrides the size's default weight (display/title/heading: semibold, label: medium, body/mono: regular). */
  weight?: TextWeight;
  /**
   * Maps to a `--cl-text*`/semantic-tone color class. Left unset by default (rather than
   * defaulting to `'default'`) so components with their own color logic — e.g. `StatusBadge`,
   * `MoneyDisplay`'s state-based coloring — can pass color via `className` without fighting a
   * Text-applied color class; Tailwind doesn't guarantee a later class in the string wins over
   * an earlier one, so the two approaches can't safely coexist on the same element.
   */
  tone?: TextTone;
  /** Semantic tag to render, independent of `size` — e.g. an `h3`-level heading visually sized as `body`. */
  as?: TextElement;
  /** Only meaningful when `as="label"`. */
  htmlFor?: string;
}

// display/title/heading render semibold; label renders medium; body/mono render regular — kept as
// a literal table (not derived from typography.scale's numeric weight) so it stays a compile-time
// mapping to the 3-value TextWeight union rather than parsing arbitrary numbers at runtime.
const DEFAULT_WEIGHT: Record<TextSize, TextWeight> = {
  display: 'semibold',
  title: 'semibold',
  heading: 'semibold',
  body: 'regular',
  label: 'medium',
  mono: 'regular',
};

const DEFAULT_ELEMENT: Record<TextSize, TextElement> = {
  display: 'h1',
  title: 'h2',
  heading: 'h3',
  body: 'p',
  label: 'label',
  mono: 'span',
};

// typography.scale has no lineHeight field yet — these are a deliberate judgment call (tighter
// leading as size increases) rather than sourced from the token file.
const LINE_HEIGHT: Record<TextSize, number> = {
  display: 1.15,
  title: 1.25,
  heading: 1.35,
  body: 1.5,
  label: 1.45,
  mono: 1.5,
};

const WEIGHT_CLASS: Record<TextWeight, string> = {
  regular: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
};

const TONE_CLASS: Record<TextTone, string> = {
  default: 'text-cl-text',
  muted: 'text-cl-text-2',
  faint: 'text-cl-text-3',
  accent: 'text-cl-accent-text',
  positive: 'text-cl-pos',
  negative: 'text-cl-neg',
  warning: 'text-cl-warn',
  critical: 'text-cl-crit',
};

/**
 * Typography primitive backed by design-tokens' `typography.scale` — the single source of truth
 * for font size, weight, letter-spacing, and family across `display`/`title`/`heading`/`body`/
 * `label`/`mono`. `size` (visual scale) and `as` (semantic tag) are independent, so a heading can
 * be visually de-emphasized (or vice versa) without breaking the document outline.
 */
export function Text({
  size = 'body',
  weight,
  tone,
  as,
  className,
  htmlFor,
  children,
  ...rest
}: TextProps) {
  const scale = typography.scale[size];
  const Element: ElementType = as ?? DEFAULT_ELEMENT[size];
  const resolvedWeight = weight ?? DEFAULT_WEIGHT[size];

  return (
    <Element
      htmlFor={htmlFor}
      className={[
        scale.family === 'mono' ? 'font-cl-mono' : 'font-cl-ui',
        WEIGHT_CLASS[resolvedWeight],
        tone ? TONE_CLASS[tone] : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        fontSize: scale.size,
        letterSpacing: scale.letterSpacing,
        lineHeight: LINE_HEIGHT[size],
        fontVariantNumeric: 'tabularNums' in scale && scale.tabularNums ? 'tabular-nums' : undefined,
      }}
      {...rest}
    >
      {children}
    </Element>
  );
}
