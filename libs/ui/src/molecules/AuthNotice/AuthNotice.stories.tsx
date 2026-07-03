import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AuthNotice } from './AuthNotice';

const meta: Meta<typeof AuthNotice> = {
  title: 'Molecules/AuthNotice',
  component: AuthNotice,
  argTypes: {
    tone: {
      control: 'select',
      options: ['accent', 'warning', 'critical', 'positive', 'neutral'],
    },
  },
};
export default meta;

type Story = StoryObj<typeof AuthNotice>;

export const CheckYourEmail: Story = {
  args: {
    icon: 'mail',
    tone: 'accent',
    title: 'Check your email',
    description: "If that email is registered, we've sent a reset link. It's valid for 1 hour.",
    secondaryAction: { label: 'Back to sign in', onClick: fn() },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Back to sign in' }));
    await expect(args.secondaryAction?.onClick).toHaveBeenCalledOnce();
  },
};

export const LinkExpired: Story = {
  args: {
    icon: 'clock',
    tone: 'warning',
    title: 'This link has expired',
    description: 'Reset links are valid for 1 hour. Request a new one to continue.',
    primaryAction: { label: 'Resend link', onClick: fn() },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Resend link' }));
    await expect(args.primaryAction?.onClick).toHaveBeenCalledOnce();
  },
};

export const SignedOutForSecurity: Story = {
  args: {
    icon: 'shield-check',
    tone: 'accent',
    title: "You've been signed out",
    description: 'For your security, we signed you out. Please sign in again.',
    primaryAction: { label: 'Sign in', onClick: fn() },
  },
};
