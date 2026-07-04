import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ConfirmationDialog } from './ConfirmationDialog';
import { Button } from '../../atoms/Button';

const meta: Meta<typeof ConfirmationDialog> = {
  title: 'Molecules/ConfirmationDialog',
  component: ConfirmationDialog,
};
export default meta;

type Story = StoryObj<typeof ConfirmationDialog>;

function Demo({ countdown, onConfirm }: { countdown: number; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button label="Send payment" onClick={() => setOpen(true)} />
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="Send $5,000.00 to Acme Corp?"
        body="This transfers funds immediately and can't be undone. A reversing entry would be required to recover it."
        confirmLabel="Send payment"
        countdown={countdown}
        onConfirm={() => {
          onConfirm();
          setOpen(false);
        }}
      />
    </>
  );
}

export const Interactive: Story = {
  render: () => <Demo countdown={3} onConfirm={() => window.alert('Payment sent')} />,
};

export const DisabledDuringCountdown: Story = {
  args: { onConfirm: fn() },
  render: (args) => <Demo countdown={3} onConfirm={args.onConfirm ?? (() => {})} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Send payment' }));
    const dialog = within(await body.findByRole('dialog'));
    const confirmButton = dialog.getByRole('button', { name: /Confirm in 3…/ });
    // Stays enabled/focusable so keyboard/screen-reader users aren't stranded — aria-disabled +
    // aria-describedby (pointing at the visually-hidden countdown reason) explain the gate instead.
    await expect(confirmButton).not.toBeDisabled();
    await expect(confirmButton).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmButton).toHaveAttribute('aria-describedby');

    await userEvent.click(dialog.getByRole('button', { name: /Cancel/ }));
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};

export const ConfirmsWhenArmed: Story = {
  args: { onConfirm: fn() },
  render: (args) => <Demo countdown={0} onConfirm={args.onConfirm ?? (() => {})} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Send payment' }));
    const dialog = within(await body.findByRole('dialog'));
    const confirmButton = dialog.getByRole('button', { name: 'Send payment' });
    await expect(confirmButton).toBeEnabled();

    await userEvent.click(confirmButton);
    await expect(args.onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
  },
};
