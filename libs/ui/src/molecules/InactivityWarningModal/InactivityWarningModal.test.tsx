import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InactivityWarningModal } from './InactivityWarningModal';

describe('InactivityWarningModal', () => {
  it('renders nothing when closed', () => {
    render(
      <InactivityWarningModal
        open={false}
        secondsRemaining={60}
        onStaySignedIn={() => {}}
        onSignOut={() => {}}
      />,
    );
    expect(screen.queryByText('Still there?')).not.toBeInTheDocument();
  });

  it('shows the fixed "60 seconds" warning copy and the live countdown ring (AC-04)', () => {
    render(
      <InactivityWarningModal
        open
        secondsRemaining={58}
        onStaySignedIn={() => {}}
        onSignOut={() => {}}
      />,
    );

    expect(screen.getByText('Still there?')).toBeInTheDocument();
    expect(
      screen.getByText("You'll be signed out in 60 seconds due to inactivity."),
    ).toBeInTheDocument();
    expect(screen.getByText('0:58')).toBeInTheDocument();
  });

  it('formats a full minute remaining as 1:00', () => {
    render(
      <InactivityWarningModal
        open
        secondsRemaining={60}
        onStaySignedIn={() => {}}
        onSignOut={() => {}}
      />,
    );
    expect(screen.getByText('1:00')).toBeInTheDocument();
  });

  it('calls onStaySignedIn when "Stay signed in" is clicked (AC-05)', async () => {
    const onStaySignedIn = vi.fn();
    const user = userEvent.setup();
    render(
      <InactivityWarningModal
        open
        secondsRemaining={30}
        onStaySignedIn={onStaySignedIn}
        onSignOut={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Stay signed in' }));
    expect(onStaySignedIn).toHaveBeenCalledTimes(1);
  });

  it('calls onSignOut when "Sign out" is clicked', async () => {
    const onSignOut = vi.fn();
    const user = userEvent.setup();
    render(
      <InactivityWarningModal
        open
        secondsRemaining={30}
        onStaySignedIn={() => {}}
        onSignOut={onSignOut}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('treats dismissing via Escape as "interacting with the page" and resets the timer (AC-05)', async () => {
    const onStaySignedIn = vi.fn();
    const user = userEvent.setup();
    render(
      <InactivityWarningModal
        open
        secondsRemaining={30}
        onStaySignedIn={onStaySignedIn}
        onSignOut={() => {}}
      />,
    );

    await user.keyboard('{Escape}');
    expect(onStaySignedIn).toHaveBeenCalledTimes(1);
  });
});
