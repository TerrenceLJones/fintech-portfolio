import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { label: 'Approve', variant: 'primary', icon: 'check' } };
export const Secondary: Story = { args: { label: 'Export', variant: 'secondary', icon: 'download' } };
export const Ghost: Story = { args: { label: 'Details', variant: 'ghost' } };
export const Danger: Story = { args: { label: 'Reject', variant: 'danger' } };
export const Disabled: Story = { args: { label: 'Approve', icon: 'lock', disabled: true } };
export const Loading: Story = { args: { label: 'Processing', loading: true } };
export const FullWidth: Story = { args: { label: 'Sign in', fullWidth: true } };
