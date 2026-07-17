import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SidebarFooter } from './SidebarFooter';

const IDENTITY = {
  name: 'Marcus Okafor',
  initials: 'MO',
  roleLabel: 'Finance Manager',
  detail: '$10k limit',
};

describe('SidebarFooter', () => {
  it('renders the avatar initials, name, and the role combined with its detail', () => {
    render(<SidebarFooter identity={IDENTITY} />);
    expect(screen.getByText('MO')).toBeInTheDocument();
    expect(screen.getByText('Marcus Okafor')).toBeInTheDocument();
    expect(screen.getByText('Finance Manager · $10k limit')).toBeInTheDocument();
  });

  it('shows just the role when there is no detail', () => {
    render(
      <SidebarFooter identity={{ name: 'Priya Nair', initials: 'PN', roleLabel: 'Employee' }} />,
    );
    expect(screen.getByText('Employee')).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it('truncates a long name and keeps its full value in a title for accessibility', () => {
    render(<SidebarFooter identity={{ ...IDENTITY, name: 'Alexandria Bartholomew-Fitzgerald' }} />);
    const name = screen.getByText('Alexandria Bartholomew-Fitzgerald');
    expect(name).toHaveClass('truncate');
    expect(name).toHaveAttribute('title', 'Alexandria Bartholomew-Fitzgerald');
  });

  it('renders a loading placeholder without a name while the session resolves', () => {
    render(<SidebarFooter loading />);
    expect(screen.queryByText('Marcus Okafor')).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-footer-loading')).toBeInTheDocument();
  });

  it('renders with no ThemeProvider or AppShell ancestor', () => {
    expect(() => render(<SidebarFooter identity={IDENTITY} />)).not.toThrow();
  });
});
