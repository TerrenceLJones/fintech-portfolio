import type { Meta, StoryObj } from '@storybook/react-vite';
import { IntegrationCard } from './IntegrationCard';

const meta: Meta<typeof IntegrationCard> = {
  title: 'Organisms/IntegrationCard',
  component: IntegrationCard,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof IntegrationCard>;

export const Connected: Story = {
  args: {
    integration: {
      provider: 'quickbooks',
      name: 'QuickBooks Online',
      status: 'connected',
      accountEmail: 'books@acme.com',
      lastSyncAt: '2026-07-15T02:00:00.000Z',
      lastSyncOutcome: 'success',
    },
    initials: 'QB',
    lastSyncLabel: 'Jul 15 · 02:00 AM',
  },
};

export const Syncing: Story = {
  args: { ...Connected.args, syncing: true },
};

export const Error: Story = {
  args: {
    integration: {
      provider: 'netsuite',
      name: 'NetSuite',
      status: 'error',
      accountEmail: 'acme-prod',
      errorMessage: 'Token expired at last sync (Jul 12). Reconnect to resume auto-sync.',
    },
    initials: 'NS',
  },
};

export const Disconnected: Story = {
  args: {
    integration: { provider: 'xero', name: 'Xero', status: 'disconnected' },
    initials: 'X',
  },
};
