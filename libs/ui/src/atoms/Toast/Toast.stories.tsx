import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toast } from './Toast';

const meta: Meta<typeof Toast> = {
  title: 'Atoms/Toast',
  component: Toast,
  argTypes: {
    tone: { control: 'select', options: ['positive', 'neutral', 'negative'] },
    role: { control: 'select', options: ['status', 'alert'] },
  },
};
export default meta;

type Story = StoryObj<typeof Toast>;

export const Approved: Story = { args: { message: '10 approved' } };
export const Neutral: Story = { args: { tone: 'neutral', message: 'Draft saved' } };
export const Negative: Story = {
  args: { tone: 'negative', role: 'alert', message: "Couldn't complete that action" },
};
