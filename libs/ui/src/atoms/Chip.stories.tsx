import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chip } from './Chip';

const meta: Meta<typeof Chip> = {
  title: 'Atoms/Chip',
  component: Chip,
};
export default meta;

type Story = StoryObj<typeof Chip>;

export const Selected: Story = { args: { label: 'Software', selected: true } };
export const Default: Story = { args: { label: 'Travel' } };
export const Removable: Story = { args: { label: 'Meals', removable: true } };
