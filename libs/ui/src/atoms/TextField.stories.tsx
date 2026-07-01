import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from './TextField';

const meta: Meta<typeof TextField> = {
  title: 'Atoms/TextField',
  component: TextField,
};
export default meta;

type Story = StoryObj<typeof TextField>;

export const Default: Story = { args: { label: 'Work email', defaultValue: 'dreyes@northwind.example' } };
export const Focus: Story = { args: { label: 'Amount', prefix: '$', defaultValue: '5,000.00', state: 'focus' } };
export const Error: Story = {
  args: { label: 'Password', placeholder: 'Enter your password', state: 'error', error: 'Incorrect password' },
};
export const Disabled: Story = {
  args: { label: 'Account', defaultValue: '••4021 · Operating', state: 'disabled' },
};
