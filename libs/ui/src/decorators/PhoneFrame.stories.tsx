import type { Meta, StoryObj } from '@storybook/react-vite';
import { PhoneFrame } from './PhoneFrame';
import { AIInsightCard } from '../molecules/AIInsightCard';
import { Button } from '../atoms/Button';

const meta: Meta<typeof PhoneFrame> = {
  title: 'Decorators/PhoneFrame',
  component: PhoneFrame,
};
export default meta;

type Story = StoryObj<typeof PhoneFrame>;

export const WithContent: Story = {
  args: {
    time: '9:41',
    width: 248,
    height: 420,
    children: (
      <div className="flex h-full flex-col gap-3 p-3.5">
        <AIInsightCard
          tone="anomaly"
          title="Unusual charge"
          body="About 4x the usual for this vendor."
          confidence={87}
        />
        <Button label="Review charge" variant="primary" fullWidth />
      </div>
    ),
  },
};
