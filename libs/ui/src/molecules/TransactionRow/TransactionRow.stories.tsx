import type { Meta, StoryObj } from '@storybook/react-vite';
import { TransactionRow } from './TransactionRow';

const meta: Meta<typeof TransactionRow> = {
  title: 'Molecules/TransactionRow',
  component: TransactionRow,
  decorators: [
    (Story) => (
      <div className="max-w-96">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof TransactionRow>;

export const Live: Story = {
  args: {
    merchant: 'Notion Labs',
    category: 'Software',
    time: 'just now',
    amount: 150,
    initials: 'No',
    state: 'live',
  },
};
export const Default: Story = {
  args: {
    merchant: 'Amazon Web Services',
    category: 'Software',
    time: '2h ago',
    amount: 48,
    initials: 'AW',
  },
};
export const Dim: Story = {
  args: {
    merchant: 'WeWork',
    category: 'Office Supplies',
    time: 'Jun 26',
    amount: 220,
    initials: 'We',
    state: 'dim',
  },
};
export const DeclinedMcc: Story = {
  args: {
    merchant: 'Vista Grill',
    category: 'Restaurants',
    time: 'just now',
    amount: 64,
    state: 'declined',
    declineReason: 'MCC restricted (Restaurants)',
  },
};
export const DeclinedLimit: Story = {
  args: {
    merchant: 'GitHub',
    category: 'Software',
    time: 'just now',
    amount: 75,
    state: 'declined',
    declineReason: 'insufficient limit remaining',
  },
};
