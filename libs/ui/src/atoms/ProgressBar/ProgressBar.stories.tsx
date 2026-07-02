import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from './ProgressBar';

const meta: Meta<typeof ProgressBar> = {
  title: 'Atoms/ProgressBar',
  component: ProgressBar,
  argTypes: {
    tone: { control: 'select', options: ['accent', 'positive', 'warning', 'negative', 'critical'] },
  },
};
export default meta;

type Story = StoryObj<typeof ProgressBar>;

export const Accent: Story = { args: { value: 46, tone: 'accent', label: 'Accent' } };
export const Warning: Story = { args: { value: 80, tone: 'warning', label: 'Warning' } };
export const Critical: Story = {
  args: { value: 104, max: 100, tone: 'critical', label: 'Critical' },
};
