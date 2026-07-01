import type { Meta, StoryObj } from '@storybook/react-vite';
import { AIInsightCard } from './AIInsightCard';

const meta: Meta<typeof AIInsightCard> = {
  title: 'Molecules/AIInsightCard',
  component: AIInsightCard,
  decorators: [
    (Story) => (
      <div className="max-w-96">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof AIInsightCard>;

export const Info: Story = {
  args: {
    title: 'June spend summary',
    body: 'June spend totaled $487,210.50 across 1,204 transactions — up 8% on May, driven by Engineering cloud costs.',
    confidence: 92,
    tone: 'info',
  },
};

export const Anomaly: Story = {
  args: {
    title: 'Unusual charge detected',
    body: 'This is about 4× the usual monthly charge for this vendor (~$11,000).',
    confidence: 87,
    tone: 'anomaly',
    actionPrimary: 'Review charge',
    actionSecondary: 'Dismiss',
  },
};
