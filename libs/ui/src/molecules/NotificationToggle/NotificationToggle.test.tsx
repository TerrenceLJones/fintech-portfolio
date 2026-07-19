import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationToggle } from './NotificationToggle';

const baseProps = {
  label: 'Budget at 80%',
  description: 'When a budget you own reaches 80% of its limit',
  supportsFrequency: true,
};

describe('NotificationToggle (AC-07/08)', () => {
  it('shows the frequency selector when a channel is on', () => {
    render(
      <NotificationToggle
        {...baseProps}
        email
        inApp={false}
        frequency="daily"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Frequency — Budget at 80%' })).toBeInTheDocument();
    expect(screen.queryByText("You won't be notified")).not.toBeInTheDocument();
  });

  it('replaces the frequency selector with "You won\'t be notified" when both channels are off (AC-08)', () => {
    render(
      <NotificationToggle
        {...baseProps}
        email={false}
        inApp={false}
        frequency="instant"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("You won't be notified")).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('never shows frequency for a non-frequency type even with a channel on (AC-09)', () => {
    render(
      <NotificationToggle
        label="Security alerts"
        description="New sign-ins and changes to your password"
        supportsFrequency={false}
        email
        inApp
        frequency="instant"
        onChange={() => {}}
      />,
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('emits the full next state when a channel is toggled (AC-07)', async () => {
    const onChange = vi.fn();
    render(
      <NotificationToggle
        {...baseProps}
        email
        inApp={false}
        frequency="daily"
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('switch', { name: 'In-App — Budget at 80%' }));
    expect(onChange).toHaveBeenCalledWith({ email: true, inApp: true, frequency: 'daily' });
  });
});
