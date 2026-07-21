import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Integration } from '@clearline/contracts';
import { IntegrationCard } from './IntegrationCard';

const base: Integration = {
  provider: 'quickbooks',
  name: 'QuickBooks Online',
  status: 'connected',
};

describe('IntegrationCard (design §19.8)', () => {
  it('renders the status label as text, not colour alone', () => {
    render(
      <IntegrationCard
        integration={{ ...base, status: 'error', errorMessage: 'Token expired.' }}
        initials="QB"
      />,
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Token expired.')).toBeInTheDocument();
  });

  it('offers Connect only when disconnected (AC-01)', async () => {
    const onConnect = vi.fn();
    render(
      <IntegrationCard
        integration={{ ...base, status: 'disconnected' }}
        initials="QB"
        onConnect={onConnect}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('offers Sync now, GL mapping, log and Disconnect when connected', () => {
    render(<IntegrationCard integration={base} initials="QB" lastSyncLabel="Jul 15" />);
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure GL mapping' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View sync log' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
  });

  it('shows Reconnect alongside Sync now in the error state (AC-04)', () => {
    render(<IntegrationCard integration={{ ...base, status: 'error' }} initials="QB" />);
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeInTheDocument();
  });

  it('renders the Syncing… badge and disables Sync now while syncing (AC-03)', () => {
    render(<IntegrationCard integration={base} initials="QB" syncing />);
    expect(screen.getByText('Syncing…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync now' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
