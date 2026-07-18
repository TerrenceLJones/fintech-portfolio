import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmationDialog } from './ConfirmationDialog';

describe('ConfirmationDialog', () => {
  it('announces to screen readers when the countdown finishes and the action is armed (WCAG AC-05)', () => {
    vi.useFakeTimers();
    try {
      render(<ConfirmationDialog open onOpenChange={() => {}} title="Confirm?" countdown={1} />);

      // While counting down, the polite live region holds no armed announcement yet.
      const liveRegion = screen.getByRole('status', { name: /confirmation timer/i });
      expect(liveRegion).not.toHaveTextContent(/can now confirm/i);

      // Advance past the countdown; the live region announces that confirmation is now available.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(liveRegion).toHaveTextContent(/can now confirm/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gates the confirm button while counting down, but keeps it focusable and explained', () => {
    render(
      <ConfirmationDialog
        open
        onOpenChange={() => {}}
        title="Send $5,000.00 to Acme Corp?"
        countdown={3}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: /Confirm in 3/ });
    expect(confirmButton).not.toBeDisabled();
    expect(confirmButton).toHaveAttribute('aria-disabled', 'true');

    confirmButton.focus();
    expect(confirmButton).toHaveFocus();

    const reasonId = confirmButton.getAttribute('aria-describedby');
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId as string)).toHaveTextContent(/waiting a few seconds/i);
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

    const confirmButton = screen.getByRole('button', { name: /Confirm in 3/ });
    expect(confirmButton).not.toBeDisabled();
    expect(confirmButton).toHaveAttribute('aria-disabled', 'true');
  });
});
