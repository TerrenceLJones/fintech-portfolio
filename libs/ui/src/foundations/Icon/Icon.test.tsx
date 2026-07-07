import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Icon } from './Icon';
import { iconRegistry, type IconName } from '@clearline/icons';

describe('Icon', () => {
  it('renders the named icon with its registry viewBox and default stroke-width', () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', iconRegistry.check.viewBox);
    expect(svg).toHaveAttribute('stroke-width', String(iconRegistry.check.sw));
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
  });

  it('applies a custom size, stroke, and color', () => {
    const { container } = render(<Icon name="triangle-alert" size={24} stroke={2.4} color="red" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
    expect(svg).toHaveAttribute('stroke-width', '2.4');
    expect(svg).toHaveStyle({ color: 'red' });
  });

  it('is hidden from the accessibility tree (decorative by default)', () => {
    const { container } = render(<Icon name="lock" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('forwards className to the rendered svg', () => {
    const { container } = render(<Icon name="check" className="text-cl-accent" />);
    expect(container.querySelector('svg')).toHaveClass('text-cl-accent');
  });

  it('reserves the requested size as empty space for an unknown name (never throws) — US-CW-022 AC-05', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<Icon name={'not-a-real-icon' as IconName} size={20} />);

    const svg = container.querySelector('svg');
    // Not null: layout space is reserved rather than the glyph vanishing…
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
    // …but empty (no glyph body) and still flagged as a dev-time mistake.
    expect(svg?.childElementCount).toBe(0);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('not-a-real-icon'));

    consoleError.mockRestore();
  });
});

// Registry parity: iterate every generated glyph so the renderer can't silently
// drift from @clearline/icons. For each name, the React render must reproduce
// the registry's `viewBox`, `sw`, and `body` markup — compared against a
// reference SVG element built from the same `body`, so both sides are normalized
// by the identical DOM serializer (happy-dom expands `<path/>` → `<path></path>`).
describe('Icon — registry parity', () => {
  const names = Object.keys(iconRegistry) as IconName[];

  it.each(names)('renders "%s" matching its registry definition', (name) => {
    const def = iconRegistry[name];
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('viewBox', def.viewBox);
    expect(svg).toHaveAttribute('stroke-width', String(def.sw));
    expect(svg?.childElementCount).toBeGreaterThan(0);

    const reference = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    reference.innerHTML = def.body;
    expect(svg?.innerHTML).toBe(reference.innerHTML);
  });
});
