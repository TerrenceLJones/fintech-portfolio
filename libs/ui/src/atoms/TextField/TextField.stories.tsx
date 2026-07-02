import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { TextField } from './TextField';

const meta: Meta<typeof TextField> = {
  title: 'Atoms/TextField',
  component: TextField,
};
export default meta;

type Story = StoryObj<typeof TextField>;

function ControlledTextField(args: ComponentProps<typeof TextField>) {
  const [value, setValue] = useState(args.value);
  return <TextField {...args} value={value} onChange={(e) => setValue(e.target.value)} />;
}

export const Default: Story = {
  args: { label: 'Work email', value: 'dreyes@northwind.example' },
  render: (args) => <ControlledTextField {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Work email');
    await userEvent.clear(input);
    await userEvent.type(input, 'mokafor@northwind.example');
    await expect(input).toHaveValue('mokafor@northwind.example');
  },
};
export const Focus: Story = { args: { label: 'Amount', prefix: '$', defaultValue: '5,000.00', state: 'focus' } };
export const Error: Story = {
  args: { label: 'Password', placeholder: 'Enter your password', state: 'error', error: 'Incorrect password' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Password');
    await expect(input).toBeInvalid();
    await expect(canvas.getByRole('alert')).toHaveTextContent('Incorrect password');
  },
};
export const Disabled: Story = {
  args: { label: 'Account', defaultValue: '••4021 · Operating', state: 'disabled' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Account')).toBeDisabled();
  },
};
