import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RejectReasonDialog } from './RejectReasonDialog';
import { Button } from '../../atoms/Button';

const meta: Meta<typeof RejectReasonDialog> = {
  title: 'Molecules/RejectReasonDialog',
  component: RejectReasonDialog,
};
export default meta;

type Story = StoryObj<typeof RejectReasonDialog>;

function Demo({ count }: { count?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="danger"
        label={count && count > 1 ? `Reject ${count} selected` : 'Reject'}
        onClick={() => setOpen(true)}
      />
      <RejectReasonDialog
        open={open}
        onOpenChange={setOpen}
        count={count}
        presets={['Out of policy', 'Missing detail', 'Duplicate']}
        onConfirm={(reason) => {
          window.alert(`Rejected: ${reason}`);
          setOpen(false);
        }}
      />
    </>
  );
}

/** Single-expense rejection with a required reason and one-tap presets (§6.2). */
export const SingleExpense: Story = {
  render: () => <Demo />,
};

/** Batch rejection: one shared reason attached to each of the selected expenses (§7.3). */
export const BatchRejection: Story = {
  render: () => <Demo count={5} />,
};
