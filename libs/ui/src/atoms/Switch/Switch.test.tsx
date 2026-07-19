import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './Switch';

describe('Switch', () => {
  it('exposes switch semantics with aria-checked reflecting state', () => {
    render(<Switch checked onCheckedChange={() => {}} aria-label="Email" />);
    const control = screen.getByRole('switch', { name: 'Email' });
    expect(control).toHaveAttribute('aria-checked', 'true');
  });

  it('fires onCheckedChange with the toggled value on click', async () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} aria-label="In-App" />);
    await userEvent.click(screen.getByRole('switch', { name: 'In-App' }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('does not fire when disabled', async () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch checked={false} disabled onCheckedChange={onCheckedChange} aria-label="Email" />,
    );
    await userEvent.click(screen.getByRole('switch', { name: 'Email' }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
