import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('renders the image when a src is provided', () => {
    render(<Avatar initials="MO" src="https://example.com/mo.png" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/mo.png');
    expect(screen.queryByText('MO')).not.toBeInTheDocument();
  });

  it('falls back to initials when the image fails to load', () => {
    render(<Avatar initials="MO" src="https://example.com/broken.png" />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('MO')).toBeInTheDocument();
  });

  it('uses the alt prop for the image when provided', () => {
    render(<Avatar initials="MO" src="https://example.com/mo.png" alt="Marcus Okafor" />);
    expect(screen.getByRole('img', { name: 'Marcus Okafor' })).toBeInTheDocument();
  });

  it('falls back to initials for alt text when alt is omitted', () => {
    render(<Avatar initials="MO" src="https://example.com/mo.png" />);
    expect(screen.getByRole('img', { name: 'MO' })).toBeInTheDocument();
  });
});
