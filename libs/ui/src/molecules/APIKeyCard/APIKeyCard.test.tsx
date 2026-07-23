import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { APIKeyCard } from './APIKeyCard';

const BASE = {
  name: 'Production — Read Only',
  maskedKey: 'sk_live_••••••••••••••ab3f',
  scopes: ['read:transactions', 'read:cards'],
  createdAt: '2026-06-01T10:00:00.000Z',
  lastUsedAt: '2026-07-14T22:03:00.000Z',
};

describe('APIKeyCard', () => {
  it('renders the name, masked key, and scope pills — never a full key (AC-02)', () => {
    render(<APIKeyCard {...BASE} />);
    expect(screen.getByText('Production — Read Only')).toBeInTheDocument();
    expect(screen.getByText('sk_live_••••••••••••••ab3f')).toBeInTheDocument();
    expect(screen.getByText('read:transactions')).toBeInTheDocument();
    expect(screen.getByText('read:cards')).toBeInTheDocument();
  });

  it('shows "Never used" when the key has never authenticated', () => {
    render(<APIKeyCard {...BASE} lastUsedAt={null} />);
    expect(screen.getByText('Never used')).toBeInTheDocument();
  });

  it('fires onRevoke when the Revoke button is clicked (AC-04)', async () => {
    const onRevoke = vi.fn();
    render(<APIKeyCard {...BASE} onRevoke={onRevoke} />);
    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(onRevoke).toHaveBeenCalledOnce();
  });

  it('renders no Revoke affordance when onRevoke is omitted', () => {
    render(<APIKeyCard {...BASE} />);
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
  });
});
