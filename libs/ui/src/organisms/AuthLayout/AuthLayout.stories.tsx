import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../atoms/Button';
import { TextField } from '../../atoms/TextField';
import { PasswordField } from '../../atoms/PasswordField';

const meta: Meta<typeof AuthLayout> = {
  title: 'Organisms/AuthLayout',
  component: AuthLayout,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof AuthLayout>;

export const Default: Story = {
  args: {
    children: (
      <>
        <h1 className="text-cl-text mb-1.5 text-xl font-semibold">Sign in</h1>
        <p className="text-cl-text-2 mb-6 text-sm">Use your work account to continue.</p>
        <form className="flex flex-col gap-4">
          <TextField label="Work email" type="email" autoComplete="email" required />
          <PasswordField label="Password" autoComplete="current-password" required />
          <Button type="submit" fullWidth>
            Sign in
          </Button>
        </form>
      </>
    ),
  },
};

export const CustomCopy: Story = {
  args: {
    headline: 'Reset your password',
    subcopy: "Enter your work email and we'll send a link to reset it.",
    footer: null,
    children: (
      <>
        <h1 className="text-cl-text mb-1.5 text-xl font-semibold">Reset password</h1>
        <p className="text-cl-text-2 mb-6 text-sm">
          Enter your work email and we&apos;ll send a link to reset it.
        </p>
        <form className="flex flex-col gap-4">
          <TextField label="Work email" type="email" autoComplete="email" required />
          <Button type="submit" fullWidth>
            Send reset link
          </Button>
        </form>
      </>
    ),
  },
};
