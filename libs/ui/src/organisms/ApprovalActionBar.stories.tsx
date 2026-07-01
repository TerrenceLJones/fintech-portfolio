import type { Meta, StoryObj } from '@storybook/react-vite';
import { ApprovalActionBar } from './ApprovalActionBar';

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

export const Enabled: Story = { args: { canApprove: true } };
export const DisabledWithReason: Story = {
  args: { reason: "You can't approve your own expense. It needs another approver." },
};
