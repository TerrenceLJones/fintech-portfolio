import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmationDialog } from './ConfirmationDialog';

describe('ConfirmationDialog', () => {
  it('disables the confirm button and shows the countdown while gated', () => {
    render(
      <ConfirmationDialog
        open
        onOpenChange={() => {}}
        title="Send $5,000.00 to Acme Corp?"
        countdown={3}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: /Confirm in 3/ });
    expect(confirmButton).toBeDisabled();
  });

  it('arms the confirm button once the countdown reaches zero', async () => {
    render(<ConfirmationDialog open onOpenChange={() => {}} title="Confirm?" countdown={0} />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
  });

  it('does not call onConfirm while the countdown is still gating the button', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmationDialog
        open
        onOpenChange={() => {}}
        title="Confirm?"
        countdown={3}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Confirm in 3/ }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm once armed', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmationDialog
        open
        onOpenChange={() => {}}
        title="Confirm?"
        countdown={0}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('re-gates the countdown on each open transition, even if it was previously armed', () => {
    const { rerender } = render(
      <ConfirmationDialog open onOpenChange={() => {}} title="Confirm?" countdown={0} />,
    );
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();

    rerender(
      <ConfirmationDialog open={false} onOpenChange={() => {}} title="Confirm?" countdown={3} />,
    );
    rerender(<ConfirmationDialog open onOpenChange={() => {}} title="Confirm?" countdown={3} />);

    expect(screen.getByRole('button', { name: /Confirm in 3/ })).toBeDisabled();
  });
});
