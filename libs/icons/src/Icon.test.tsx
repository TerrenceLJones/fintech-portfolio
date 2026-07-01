import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Icon } from './Icon';
import { iconRegistry, type IconName } from './icon-registry';

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
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders nothing and logs an error for an unknown icon name', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<Icon name={'not-a-real-icon' as IconName} />);

    expect(container.querySelector('svg')).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('not-a-real-icon'));

    consoleError.mockRestore();
  });
});
