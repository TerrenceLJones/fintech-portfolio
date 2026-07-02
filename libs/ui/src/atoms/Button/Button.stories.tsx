import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from './Button';
import { alertingAction } from '../../storybook-actions';

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

export const Primary: Story = {
  args: { label: 'Approve', variant: 'primary', icon: 'check', onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Approve' }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
export const Secondary: Story = {
  args: {
    label: 'Export',
    variant: 'secondary',
    icon: 'download',
    onClick: alertingAction('Exported'),
  },
};
export const Ghost: Story = {
  args: { label: 'Details', variant: 'ghost', onClick: alertingAction('Opening details…') },
};
export const Danger: Story = {
  args: { label: 'Reject', variant: 'danger', onClick: alertingAction('Rejected') },
};
export const Disabled: Story = {
  args: { label: 'Approve', icon: 'lock', disabled: true, onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Approve' });
    await expect(button).toBeDisabled();
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
export const Loading: Story = {
  args: { label: 'Processing', loading: true, onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Processing' });
    // Stays enabled/focusable (unlike `disabled`) so keyboard/screen-reader users don't lose
    // focus mid-action — aria-disabled + the guarded click handler below block the action instead.
    await expect(button).not.toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
export const FullWidth: Story = {
  args: { label: 'Sign in', fullWidth: true, onClick: alertingAction('Signed in') },
};
