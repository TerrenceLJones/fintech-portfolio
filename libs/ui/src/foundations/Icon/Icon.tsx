import type { CSSProperties } from 'react';
import { iconRegistry, type IconName } from '@clearline/icons';

export interface IconProps {
  name: IconName;
  /** Pixel size for both width and height. @default 16 */
  size?: number;
  /** Overrides the icon definition's canonical stroke-width. */
  stroke?: number;
  /** CSS color; defaults to `currentColor` via inherited text color. */
  color?: string;
  className?: string;
}

/**
 * Renders a single named glyph from the framework-agnostic @clearline/icons
 * registry with `stroke="currentColor"` so it inherits text color unless
 * `color` is set. `name` is validated at compile time against the generated
 * `IconName` union. A name absent from the registry at runtime (defensive
 * case only — TypeScript rejects it) reserves the requested size as empty
 * space rather than throwing (US-CW-022 AC-05).
 */
export function Icon({ name, size = 16, stroke, color, className }: IconProps) {
  const def = iconRegistry[name];
  const style: CSSProperties = { display: 'block', flexShrink: 0, color };

  if (!def) {
    if (import.meta.env.DEV) {
      console.error(`Icon: no definition found for name "${name}"`);
    }
    return (
      <svg
        width={size}
        height={size}
        style={style}
        className={className}
        role="img"
        aria-hidden="true"
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={def.viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke ?? def.sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      role="img"
      aria-hidden="true"
      // glyph bodies come from the generated icon registry, never user input
      dangerouslySetInnerHTML={{ __html: def.body }}
    />
  );
}
