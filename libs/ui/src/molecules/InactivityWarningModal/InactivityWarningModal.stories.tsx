import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { InactivityWarningModal } from './InactivityWarningModal';
import { Button } from '../../atoms/Button';
import { alertingAction } from '../../storybook-actions';

const meta: Meta<typeof InactivityWarningModal> = {
  title: 'Molecules/InactivityWarningModal',
  component: InactivityWarningModal,
};
export default meta;

type Story = StoryObj<typeof InactivityWarningModal>;

function Demo({
  onStaySignedIn,
  onSignOut,
}: {
  onStaySignedIn: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);

  useEffect(() => {
    if (!open) return;
    const interval = window.setInterval(() => {
      setSecondsRemaining((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [open]);

  return (
    <>
      <Button
        label="Simulate 14 minutes of inactivity"
        onClick={() => {
          setSecondsRemaining(60);
          setOpen(true);
        }}
      />
      <InactivityWarningModal
        open={open}
        secondsRemaining={secondsRemaining}
        onStaySignedIn={() => {
          onStaySignedIn();
          setOpen(false);
        }}
        onSignOut={() => {
          onSignOut();
          setOpen(false);
        }}
      />
    </>
  );
}

export const Interactive: Story = {
  render: () => (
    <Demo
      onStaySignedIn={alertingAction('Timer reset — session continues')}
      onSignOut={alertingAction('Signed out')}
    />
  ),
};

export const StaySignedInClosesAndResets: Story = {
  args: { onStaySignedIn: fn(), onSignOut: fn() },
  render: (args) => (
    <Demo
      onStaySignedIn={args.onStaySignedIn ?? (() => {})}
      onSignOut={args.onSignOut ?? (() => {})}
    />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Simulate 14 minutes of inactivity' }),
    );
    await userEvent.click(await body.findByRole('button', { name: 'Stay signed in' }));
    await expect(args.onStaySignedIn).toHaveBeenCalledOnce();
    await expect(args.onSignOut).not.toHaveBeenCalled();
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
  },
};

export const SignOutEndsTheSessionImmediately: Story = {
  args: { onStaySignedIn: fn(), onSignOut: fn() },
  render: (args) => (
    <Demo
      onStaySignedIn={args.onStaySignedIn ?? (() => {})}
      onSignOut={args.onSignOut ?? (() => {})}
    />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Simulate 14 minutes of inactivity' }),
    );
    await userEvent.click(await body.findByRole('button', { name: 'Sign out' }));
    await expect(args.onSignOut).toHaveBeenCalledOnce();
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
  },
};

export const DismissingViaEscapeCountsAsActivity: Story = {
  args: { onStaySignedIn: fn(), onSignOut: fn() },
  render: (args) => (
    <Demo
      onStaySignedIn={args.onStaySignedIn ?? (() => {})}
      onSignOut={args.onSignOut ?? (() => {})}
    />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Simulate 14 minutes of inactivity' }),
    );
    await body.findByRole('dialog');

    await userEvent.keyboard('{Escape}');

    // Escape is a dismissal, not an explicit "Sign out" — AC-05 treats it the same as any other
    // interaction with the page, so it resets the timer rather than ending the session.
    await expect(args.onStaySignedIn).toHaveBeenCalledOnce();
    await expect(args.onSignOut).not.toHaveBeenCalled();
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
  },
};
