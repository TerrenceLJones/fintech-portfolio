import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GettingStartedRailEntry } from './GettingStartedRailEntry';

describe('GettingStartedRailEntry', () => {
  it('renders the "X of N" count and a progressbar reflecting completion (US-CW-044 AC-01)', () => {
    render(<GettingStartedRailEntry completedCount={2} totalCount={4} onClick={vi.fn()} />);
    expect(screen.getByText('2 of 4')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '4');
  });

  it('opens the panel when activated (click / Enter / Space)', async () => {
    const onClick = vi.fn();
    render(<GettingStartedRailEntry completedCount={0} totalCount={2} onClick={onClick} />);
    const entry = screen.getByRole('button', { name: /getting started/i });
    await userEvent.click(entry);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('reflects the open state via aria-expanded', () => {
    const { rerender } = render(
      <GettingStartedRailEntry completedCount={1} totalCount={3} onClick={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /getting started/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    rerender(<GettingStartedRailEntry completedCount={1} totalCount={3} open onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /getting started/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
