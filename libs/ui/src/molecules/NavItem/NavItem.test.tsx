import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavItem } from './NavItem';

describe('NavItem', () => {
  it('renders the label and icon', () => {
    const { container } = render(<NavItem icon="file-text" label="My Expenses" />);
    expect(screen.getByText('My Expenses')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders a badge when provided', () => {
    render(<NavItem icon="check" label="Approvals" active badge="7" />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders no badge when omitted', () => {
    render(<NavItem icon="file-text" label="My Expenses" />);
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('is a real button that responds to clicks and keyboard activation', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<NavItem icon="file-text" label="My Expenses" onClick={onClick} />);

    const item = screen.getByRole('button', { name: 'My Expenses' });
    await user.click(item);
    expect(onClick).toHaveBeenCalledTimes(1);

    item.focus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('marks the active item with aria-current', () => {
    render(<NavItem icon="check" label="Approvals" active />);
    expect(screen.getByRole('button', { name: 'Approvals' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
