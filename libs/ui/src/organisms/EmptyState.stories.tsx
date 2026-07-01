import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from './EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'Organisms/EmptyState',
  component: EmptyState,
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const NoAccess: Story = {
  args: {
    icon: 'lock',
    title: "You don't have access to this page",
    body: 'Ask an admin if you need it. This page is available to Finance Managers and Controllers.',
    action: 'Back to My Expenses',
  },
};

export const EmptySearch: Story = {
  args: {
    icon: 'search',
    title: 'No transactions in this date range',
    body: 'Try widening the range or selecting a different period to see spend.',
    action: 'Reset to June 2026',
  },
};
