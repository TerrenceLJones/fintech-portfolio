import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert } from './Alert';

describe('Alert', () => {
  it('renders the title and an icon (status is never color alone)', () => {
    const { container } = render(<Alert tone="warning" title="8 of 10 approved" />);
    expect(screen.getByText('8 of 10 approved')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders the message when provided', () => {
    render(<Alert tone="negative" title="Connection lost" message="5 of 20 were confirmed." />);
    expect(screen.getByText('5 of 20 were confirmed.')).toBeInTheDocument();
  });

  it('invokes onAction when the action button is clicked', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<Alert tone="warning" title="Retry needed" action="Retry" onAction={onAction} />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders no action button when action is omitted', () => {
    render(<Alert tone="info" title="Heads up" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
