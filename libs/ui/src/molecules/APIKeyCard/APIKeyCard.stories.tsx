import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { APIKeyCard } from './APIKeyCard';

const meta: Meta<typeof APIKeyCard> = {
  title: 'Molecules/APIKeyCard',
  component: APIKeyCard,
};
export default meta;

type Story = StoryObj<typeof APIKeyCard>;

export const Revocable: Story = {
  args: {
    name: 'Production — Read Only',
    maskedKey: 'sk_live_••••••••••••••ab3f',
    scopes: ['read:transactions', 'read:cards'],
    createdAt: '2026-06-01T10:00:00.000Z',
    lastUsedAt: '2026-07-14T22:03:00.000Z',
    onRevoke: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('sk_live_••••••••••••••ab3f')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Revoke' }));
    await expect(args.onRevoke).toHaveBeenCalledOnce();
  },
};

export const NeverUsed: Story = {
  args: {
    name: 'CI — Full Access',
    maskedKey: 'sk_live_••••••••••••••7d21',
    scopes: ['read:transactions', 'write:transfers'],
    createdAt: '2026-07-20T09:00:00.000Z',
    lastUsedAt: null,
    onRevoke: fn(),
  },
};

export const NonRevocable: Story = {
  args: {
    name: 'Legacy — Read Only',
    maskedKey: 'sk_live_••••••••••••••11aa',
    scopes: ['read:cards'],
    createdAt: '2026-01-15T09:00:00.000Z',
    lastUsedAt: '2026-07-01T12:00:00.000Z',
  },
};
