import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { EmptyState } from './EmptyState';
import { alertingAction } from '../../storybook-actions';

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
    onAction: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Back to My Expenses' }));
    await expect(args.onAction).toHaveBeenCalledOnce();
  },
};

export const Interactive: Story = {
  args: {
    icon: 'lock',
    title: "You don't have access to this page",
    body: 'Ask an admin if you need it. This page is available to Finance Managers and Controllers.',
    action: 'Back to My Expenses',
    onAction: alertingAction('Navigating to My Expenses'),
  },
};

export const EmptySearch: Story = {
  args: {
    icon: 'search',
    title: 'No transactions in this date range',
    body: 'Try widening the range or selecting a different period to see spend.',
    action: 'Reset to June 2026',
    onAction: alertingAction('Filters reset to June 2026'),
  },
};

export const ConnectionError: Story = {
  args: {
    icon: 'triangle-alert',
    title: 'Connection problem',
    body: "Couldn't reach the server to verify your session.",
    action: 'Try again',
    onAction: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await expect(args.onAction).toHaveBeenCalledOnce();
  },
};
