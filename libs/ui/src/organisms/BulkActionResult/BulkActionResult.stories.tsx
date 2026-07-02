import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { BulkActionResult } from './BulkActionResult';
import { alertingAction } from '../../storybook-actions';

const meta: Meta<typeof BulkActionResult> = {
  title: 'Organisms/BulkActionResult',
  component: BulkActionResult,
};
export default meta;

type Story = StoryObj<typeof BulkActionResult>;

export const PartialFailure: Story = {
  args: {
    total: 10,
    failures: [
      { name: 'D. Reyes · $24,800.00', reason: 'Exceeds your $10,000 limit' },
      { name: 'K. Tanaka · $1,420.00', reason: 'Already approved by M. Okafor' },
    ],
    onRetry: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Retry failed (2)' }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};

export const Interactive: Story = {
  args: {
    total: 10,
    failures: [
      { name: 'D. Reyes · $24,800.00', reason: 'Exceeds your $10,000 limit' },
      { name: 'K. Tanaka · $1,420.00', reason: 'Already approved by M. Okafor' },
    ],
    onRetry: alertingAction('Retrying 2 failed item(s)…'),
  },
};
