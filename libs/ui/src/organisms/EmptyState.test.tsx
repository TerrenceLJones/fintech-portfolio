import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders icon, title, and body', () => {
    const { container } = render(
      <EmptyState icon="lock" title="You don't have access" body="Ask an admin if you need it." />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText("You don't have access")).toBeInTheDocument();
    expect(screen.getByText('Ask an admin if you need it.')).toBeInTheDocument();
  });

  it('renders an action button and wires onAction', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState icon="lock" title="No access" body="Body" action="Back" onAction={onAction} />,
    );

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders no action button when omitted', () => {
    render(<EmptyState icon="search" title="Nothing found" body="Body" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
