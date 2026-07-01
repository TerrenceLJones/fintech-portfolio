import type { Meta, StoryObj } from '@storybook/react-vite';
import { BulkActionResult } from './BulkActionResult';

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
  },
};
