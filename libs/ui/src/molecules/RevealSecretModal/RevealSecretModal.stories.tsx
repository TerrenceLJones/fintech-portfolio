import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { RevealSecretModal } from './RevealSecretModal';
import { Button } from '../../atoms/Button';

const meta: Meta<typeof RevealSecretModal> = {
  title: 'Molecules/RevealSecretModal',
  component: RevealSecretModal,
};
export default meta;

type Story = StoryObj<typeof RevealSecretModal>;

function Demo({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button label="Create key" onClick={() => setOpen(true)} />
      <RevealSecretModal
        open={open}
        onOpenChange={setOpen}
        title="Copy your API key"
        context={'Key "Production — Read Only" was created.'}
        secret="sk_live_EXAMPLE_reveal_once_demo_key"
        warning="This is the only time you'll see this key. Copy it now and store it securely."
        onDone={onDone}
      />
    </>
  );
}

export const Interactive: Story = {
  render: () => <Demo onDone={() => window.alert('done')} />,
};

export const RevealsThenAcknowledges: Story = {
  args: { onDone: fn() },
  render: (args) => <Demo onDone={args.onDone ?? (() => {})} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create key' }));
    const dialog = within(await body.findByRole('dialog'));
    await expect(dialog.getByText('sk_live_EXAMPLE_reveal_once_demo_key')).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', { name: /I've copied it — done/ }));
    await expect(args.onDone).toHaveBeenCalledOnce();
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
  },
};
