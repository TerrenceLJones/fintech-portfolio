import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders at most two initials, uppercased', () => {
    render(<Avatar initials="dara reyes" />);
    expect(screen.getByText('da')).toBeInTheDocument();
  });

  it('sizes the avatar via the size prop', () => {
    const { container } = render(<Avatar initials="MO" size={44} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe('44px');
    expect(el.style.height).toBe('44px');
  });
});
