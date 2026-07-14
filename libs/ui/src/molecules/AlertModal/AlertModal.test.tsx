import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertModal } from './AlertModal';

describe('AlertModal', () => {
  it('renders nothing when closed', () => {
    render(<AlertModal open={false} onOpenChange={() => {}} title="Send $5,000.00?" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the title and body when open, focus-trapped in a dialog role', () => {
    render(
      <AlertModal
        open
        onOpenChange={() => {}}
        title="Send $5,000.00 to Acme Corp?"
        body="This can't be undone."
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Send $5,000.00 to Acme Corp?')).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <AlertModal
        open
        onOpenChange={() => {}}
        title="Confirm?"
        confirmLabel="Send"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) on Escape and on cancel click', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<AlertModal open onOpenChange={onOpenChange} title="Confirm?" cancelLabel="Cancel" />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
