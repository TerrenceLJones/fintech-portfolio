import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
