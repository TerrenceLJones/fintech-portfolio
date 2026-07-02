import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  it('defaults to the first option when uncontrolled', () => {
    render(<SegmentedControl options={['Light', 'Dark']} />);
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches the active option on click and calls onChange', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedControl options={['Light', 'Dark']} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Dark' }));

    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'false');
    expect(onChange).toHaveBeenCalledWith('Dark');
  });

  it('respects a controlled value prop', () => {
    render(<SegmentedControl options={['Comfortable', 'Compact']} value="Compact" />);
    expect(screen.getByRole('button', { name: 'Compact' })).toHaveAttribute('aria-pressed', 'true');
  });
});
