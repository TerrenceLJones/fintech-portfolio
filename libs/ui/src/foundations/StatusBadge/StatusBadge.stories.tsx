import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusBadge } from './StatusBadge';

const meta: Meta<typeof StatusBadge> = {
  title: 'Foundations/StatusBadge',
  component: StatusBadge,
};
export default meta;

type Story = StoryObj<typeof StatusBadge>;

export const Draft: Story = { args: { status: 'draft' } };
export const PendingL1: Story = { args: { status: 'pending-l1' } };
export const PendingL2: Story = { args: { status: 'pending-l2' } };
export const Approved: Story = { args: { status: 'approved' } };
export const Active: Story = { args: { status: 'active' } };
export const Paid: Story = { args: { status: 'paid' } };
export const Reconciled: Story = { args: { status: 'reconciled' } };
export const Rejected: Story = { args: { status: 'rejected' } };
export const Reversed: Story = { args: { status: 'reversed' } };
export const Frozen: Story = { args: { status: 'frozen' } };
export const UnderReview: Story = { args: { status: 'under-review' } };

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status="draft" />
      <StatusBadge status="pending-l1" />
      <StatusBadge status="pending-l2" />
      <StatusBadge status="approved" />
      <StatusBadge status="active" />
      <StatusBadge status="paid" />
      <StatusBadge status="reconciled" />
      <StatusBadge status="rejected" />
      <StatusBadge status="reversed" />
      <StatusBadge status="frozen" />
      <StatusBadge status="under-review" />
    </div>
  ),
};
