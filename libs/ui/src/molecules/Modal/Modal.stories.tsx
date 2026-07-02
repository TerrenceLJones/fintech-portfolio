import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Modal } from './Modal';
import { Button } from '../../atoms/Button';
import { alertingAction } from '../../storybook-actions';

const meta: Meta<typeof Modal> = {
  title: 'Molecules/Modal',
  component: Modal,
};
export default meta;

type Story = StoryObj<typeof Modal>;

function Demo({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button label="Open modal" onClick={() => setOpen(true)} />
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Send $5,000.00 to Acme Corp?"
        body="This transfers funds immediately and can't be undone."
        confirmLabel="Send"
        onConfirm={() => {
          onConfirm();
          setOpen(false);
        }}
      />
    </>
  );
}

export const ConfirmSendsAndCloses: Story = {
  args: { onConfirm: fn() },
  render: (args) => <Demo onConfirm={args.onConfirm ?? (() => {})} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Open modal' }));
    await userEvent.click(await body.findByRole('button', { name: 'Send' }));
    await expect(args.onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
  },
};

export const Interactive: Story = {
  render: () => <Demo onConfirm={alertingAction('Payment sent')} />,
};

export const CancelCloses: Story = {
  args: { onConfirm: fn() },
  render: (args) => <Demo onConfirm={args.onConfirm ?? (() => {})} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Open modal' }));
    await userEvent.click(await body.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};
