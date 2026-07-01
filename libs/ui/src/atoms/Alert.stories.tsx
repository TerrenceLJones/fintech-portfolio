import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert } from './Alert';

const meta: Meta<typeof Alert> = {
  title: 'Atoms/Alert',
  component: Alert,
  argTypes: {
    tone: { control: 'select', options: ['info', 'positive', 'warning', 'negative', 'critical', 'neutral'] },
  },
};
export default meta;

type Story = StoryObj<typeof Alert>;

export const Warning: Story = {
  args: {
    tone: 'warning',
    title: "8 of 10 approved. 2 couldn't be processed — review and retry.",
    action: 'Retry failed',
  },
};
export const Negative: Story = {
  args: { tone: 'negative', title: 'Connection lost mid-batch.', message: '5 of 20 were confirmed before the drop.' },
};
export const Positive: Story = { args: { tone: 'positive', title: 'Payment sent to Acme Corp.' } };
export const Info: Story = {
  args: { tone: 'info', title: 'New transactions are blocked. Existing authorizations still settle.' },
};
export const Critical: Story = { args: { tone: 'critical', title: 'We’re double-checking your balance.' } };
export const Neutral: Story = { args: { tone: 'neutral', title: 'You can keep exploring while we review.' } };
