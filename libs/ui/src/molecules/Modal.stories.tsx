import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Modal } from './Modal';
import { Button } from '../atoms/Button';

const meta: Meta<typeof Modal> = {
  title: 'Molecules/Modal',
  component: Modal,
};
export default meta;

type Story = StoryObj<typeof Modal>;

export const Interactive: Story = {
  render: () => {
    function Demo() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <Button label="Open modal" onClick={() => setOpen(true)} />
          <Modal
            open={open}
            onOpenChange={setOpen}
            title="Send $5,000.00 to Acme Corp?"
            body="This transfers funds immediately and can't be undone."
            confirmLabel="Send"
            onConfirm={() => setOpen(false)}
          />
        </>
      );
    }
    return <Demo />;
  },
};
