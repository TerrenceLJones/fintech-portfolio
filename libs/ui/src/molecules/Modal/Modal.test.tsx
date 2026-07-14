import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

function renderShell(onOpenChange = vi.fn(), open = true) {
  return render(
    <Modal open={open} onOpenChange={onOpenChange} maxWidth={340}>
      <Modal.Title>Verify it&apos;s you</Modal.Title>
      <Modal.Description>Enter your code.</Modal.Description>
      <Modal.Close asChild>
        <button type="button">Cancel</button>
      </Modal.Close>
    </Modal>,
  );
}

describe('Modal', () => {
  it('renders its children in an accessible dialog when open', () => {
    renderShell();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // The title/description are wired to the dialog for a11y.
    expect(dialog).toHaveAccessibleName("Verify it's you");
    expect(screen.getByText('Enter your code.')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderShell(vi.fn(), false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('requests close on Escape and via a Modal.Close trigger', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderShell(onOpenChange);

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);

    onOpenChange.mockClear();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
