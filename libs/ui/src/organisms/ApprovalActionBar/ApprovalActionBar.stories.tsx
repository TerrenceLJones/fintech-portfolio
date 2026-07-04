import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ApprovalActionBar } from './ApprovalActionBar';
import { alertingAction } from '../../storybook-actions';

const meta: Meta<typeof ApprovalActionBar> = {
  title: 'Organisms/ApprovalActionBar',
  component: ApprovalActionBar,
  decorators: [
    (Story) => (
      <div className="max-w-96">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ApprovalActionBar>;

export const Enabled: Story = {
  args: { canApprove: true, onApprove: fn(), onReject: fn(), onEscalate: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Approve' }));
    await expect(args.onApprove).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole('button', { name: 'Reject' }));
    await expect(args.onReject).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole('button', { name: 'Escalate' }));
    await expect(args.onEscalate).toHaveBeenCalledOnce();
  },
};
export const DisabledWithReason: Story = {
  args: {
    reason: "You can't approve your own expense. It needs another approver.",
    onApprove: fn(),
    onReject: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const approve = canvas.getByRole('button', { name: 'Approve' });
    // Stays enabled/focusable so keyboard/screen-reader users aren't stranded — aria-disabled +
    // aria-describedby (pointing at the visible reason text) explain the gate instead.
    await expect(approve).not.toBeDisabled();
    await expect(approve).toHaveAttribute('aria-disabled', 'true');
    await expect(approve).toHaveAttribute('aria-describedby');
    await userEvent.click(approve);
    await expect(args.onApprove).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole('button', { name: 'Reject' }));
    await expect(args.onReject).toHaveBeenCalledOnce();
  },
};

export const Interactive: Story = {
  args: {
    canApprove: true,
    onApprove: alertingAction('Approved'),
    onReject: alertingAction('Rejected'),
    onEscalate: alertingAction('Escalated'),
  },
};
