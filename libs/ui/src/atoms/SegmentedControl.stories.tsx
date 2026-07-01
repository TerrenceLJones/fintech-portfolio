import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedControl } from './SegmentedControl';

const meta: Meta<typeof SegmentedControl> = {
  title: 'Atoms/SegmentedControl',
  component: SegmentedControl,
};
export default meta;

type Story = StoryObj<typeof SegmentedControl>;

export const ThemeToggle: Story = { args: { options: ['Light', 'Dark'] } };
export const DensityToggle: Story = { args: { options: ['Comfortable', 'Compact'] } };
