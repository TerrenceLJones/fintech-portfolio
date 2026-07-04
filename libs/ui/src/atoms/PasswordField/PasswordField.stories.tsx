import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { PasswordField } from './PasswordField';

const meta: Meta<typeof PasswordField> = {
  title: 'Atoms/PasswordField',
  component: PasswordField,
};
export default meta;

type Story = StoryObj<typeof PasswordField>;

export const Default: Story = {
  args: {
    label: 'Password',
    defaultValue: 'correct-horse-battery-staple',
    autoComplete: 'current-password',
  },
};

export const ToggleReveal: Story = {
  args: { label: 'Password', defaultValue: 'correct-horse-battery-staple' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Password');
    await expect(input).toHaveAttribute('type', 'password');

    await userEvent.click(canvas.getByRole('button', { name: 'Show password' }));
    await expect(input).toHaveAttribute('type', 'text');

    await userEvent.click(canvas.getByRole('button', { name: 'Hide password' }));
    await expect(input).toHaveAttribute('type', 'password');
  },
};

export const ErrorState: Story = {
  args: { label: 'Password', state: 'error', error: 'Incorrect email or password' },
};

export const Disabled: Story = {
  args: { label: 'Password', disabled: true, defaultValue: 'correct-horse-battery-staple' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Password')).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Show password' })).toBeDisabled();
  },
};
