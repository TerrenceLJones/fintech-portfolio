import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfirmationDialog } from './ConfirmationDialog';
import { Button } from '../atoms/Button';

const meta: Meta<typeof ConfirmationDialog> = {
  title: 'Molecules/ConfirmationDialog',
  component: ConfirmationDialog,
};
export default meta;

type Story = StoryObj<typeof ConfirmationDialog>;

export const Interactive: Story = {
  render: () => {
    function Demo() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <Button label="Send payment" onClick={() => setOpen(true)} />
          <ConfirmationDialog
            open={open}
            onOpenChange={setOpen}
            title="Send $5,000.00 to Acme Corp?"
            body="This transfers funds immediately and can't be undone. A reversing entry would be required to recover it."
            confirmLabel="Send payment"
            countdown={3}
            onConfirm={() => setOpen(false)}
          />
        </>
      );
    }
    return <Demo />;
  },
};
