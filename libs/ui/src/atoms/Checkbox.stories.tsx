import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Atoms/Checkbox',
  component: Checkbox,
};
export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Checked: Story = { args: { checked: true, 'aria-label': 'Select row' } };
export const Unchecked: Story = { args: { 'aria-label': 'Select row' } };
export const Indeterminate: Story = { args: { indeterminate: true, 'aria-label': 'Select all' } };
export const Disabled: Story = { args: { checked: true, disabled: true, 'aria-label': 'Select row' } };
