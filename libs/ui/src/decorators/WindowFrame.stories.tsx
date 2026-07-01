import type { Meta, StoryObj } from '@storybook/react-vite';
import { WindowFrame } from './WindowFrame';
import { StatusBadge } from '../foundations/StatusBadge';

const meta: Meta<typeof WindowFrame> = {
  title: 'Decorators/WindowFrame',
  component: WindowFrame,
};
export default meta;

type Story = StoryObj<typeof WindowFrame>;

export const WithContent: Story = {
  args: {
    url: 'app.clearline.com/cards',
    children: (
      <div className="bg-cl-bg grid grid-cols-2 gap-3 p-4.5">
        <div className="bg-cl-surface border-cl-border rounded-lg border p-3.5">
          <div className="text-cl-text-3 mb-2 text-[11px]">Available balance</div>
          <div className="font-mono text-lg font-semibold">$48,210.00</div>
        </div>
        <div className="bg-cl-surface border-cl-border flex items-start rounded-lg border p-3.5">
          <StatusBadge status="paid" />
        </div>
      </div>
    ),
  },
};
