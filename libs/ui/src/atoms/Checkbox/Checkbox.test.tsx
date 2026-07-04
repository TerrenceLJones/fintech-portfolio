import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('reflects the checked prop via ARIA', () => {
    render(<Checkbox checked aria-label="Select all" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('reflects the indeterminate prop via ARIA', () => {
    render(<Checkbox indeterminate aria-label="Select all" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
  });

  it('calls onCheckedChange on click and keyboard activation', async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox aria-label="Select row" onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    checkbox.focus();
    await user.keyboard(' ');
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it('blocks clicks and keyboard activation while disabled but stays focusable', async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox disabled aria-label="Select row" onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeDisabled();
    expect(checkbox).toHaveAttribute('aria-disabled', 'true');

    checkbox.focus();
    expect(checkbox).toHaveFocus();

    await user.click(checkbox);
    await user.keyboard(' ');
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
