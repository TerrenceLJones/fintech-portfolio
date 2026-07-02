import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Chip } from './Chip';
import { alertingAction } from '../../storybook-actions';

const meta: Meta<typeof Chip> = {
  title: 'Atoms/Chip',
  component: Chip,
};
export default meta;

type Story = StoryObj<typeof Chip>;

export const Selected: Story = { args: { label: 'Software', selected: true } };
export const Default: Story = { args: { label: 'Travel' } };
export const Removable: Story = {
  args: { label: 'Meals', removable: true, onRemove: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Meals' }));
    await expect(args.onRemove).toHaveBeenCalledOnce();
  },
};
export const Interactive: Story = {
  args: { label: 'Meals', removable: true, onRemove: alertingAction('Removed Meals') },
};
