import type { Meta, StoryObj } from '@storybook/react-vite';
import { VirtualCard } from './VirtualCard';

const meta: Meta<typeof VirtualCard> = {
  title: 'Molecules/VirtualCard',
  component: VirtualCard,
  decorators: [
    (Story) => (
      <div className="max-w-80">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof VirtualCard>;

export const Active: Story = {
  args: { holder: 'D. Reyes — Design', last4: '4021', remaining: 1850, exp: '09/28' },
};
export const Frozen: Story = {
  args: { holder: 'S. Park — Sales', last4: '5567', exp: '09/28', state: 'frozen' },
};
