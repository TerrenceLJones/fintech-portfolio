import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RevealSecretModal } from './RevealSecretModal';

const BASE = {
  title: 'Copy your API key',
  context: 'Key "Production — Read Only" was created.',
  secret: 'sk_live_realsecretvalueab3f',
  warning: "This is the only time you'll see this key. Copy it now and store it securely.",
};

describe('RevealSecretModal', () => {
  it('shows the full secret and the one-time warning while open (AC-01/06)', () => {
    render(<RevealSecretModal {...BASE} open onOpenChange={() => {}} onDone={() => {}} />);
    expect(screen.getByText('sk_live_realsecretvalueab3f')).toBeInTheDocument();
    expect(screen.getByText(/only time you'll see this key/)).toBeInTheDocument();
  });

  it('copies the secret to the clipboard and reflects a copied state', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<RevealSecretModal {...BASE} open onOpenChange={() => {}} onDone={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Copy secret to clipboard/ }));
    expect(writeText).toHaveBeenCalledWith('sk_live_realsecretvalueab3f');
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('fires onDone and closes when acknowledged', async () => {
    const onDone = vi.fn();
    const onOpenChange = vi.fn();
    render(<RevealSecretModal {...BASE} open onOpenChange={onOpenChange} onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: /I've copied it — done/ }));
    expect(onDone).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
