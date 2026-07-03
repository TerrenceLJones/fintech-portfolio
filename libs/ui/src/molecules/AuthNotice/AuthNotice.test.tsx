import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthNotice } from './AuthNotice';

describe('AuthNotice', () => {
  it('renders the title, description, and an icon', () => {
    const { container } = render(
      <AuthNotice icon="mail" title="Check your email" description="We sent you a link." />,
    );
    expect(screen.getByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText('We sent you a link.')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders no description when omitted', () => {
    render(<AuthNotice icon="mail" title="Check your email" />);
    expect(screen.queryByText('We sent you a link.')).not.toBeInTheDocument();
  });

  it('renders the primary action as a button and fires its callback', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <AuthNotice
        icon="clock"
        title="This link has expired"
        primaryAction={{ label: 'Resend link', onClick }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Resend link' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders the secondary action and fires its callback', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <AuthNotice
        icon="mail"
        title="Check your email"
        secondaryAction={{ label: 'Back to sign in', onClick }}
      />,
    );

    await user.click(screen.getByText('Back to sign in'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders neither action when omitted', () => {
    render(<AuthNotice icon="mail" title="Check your email" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
