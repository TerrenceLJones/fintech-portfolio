import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavigationShell, type NavigationShellItem } from './NavigationShell';
import { buildNavItem } from '../../test-factories';

const EMPLOYEE_ITEMS: NavigationShellItem[] = [
  buildNavItem(),
  buildNavItem({ id: 'cards', icon: 'copy', label: 'My Cards' }),
];

const FINANCE_MANAGER_ITEMS: NavigationShellItem[] = [
  ...EMPLOYEE_ITEMS,
  buildNavItem({ id: 'approvals', icon: 'check', label: 'Approvals' }),
  buildNavItem({ id: 'reconciliation', icon: 'refresh', label: 'Reconciliation' }),
];

const CONTROLLER_ITEMS: NavigationShellItem[] = [
  ...FINANCE_MANAGER_ITEMS,
  buildNavItem({ id: 'budgets', icon: 'shield', label: 'Budget Management' }),
  buildNavItem({ id: 'audit-log', icon: 'clock', label: 'Audit Log' }),
];

describe('NavigationShell', () => {
  it('renders only the Employee-scoped items', () => {
    render(<NavigationShell items={EMPLOYEE_ITEMS} />);
    expect(screen.getByText('My Expenses')).toBeInTheDocument();
    expect(screen.getByText('My Cards')).toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Reconciliation')).not.toBeInTheDocument();
  });

  it('renders the Finance Manager-scoped items', () => {
    render(<NavigationShell items={FINANCE_MANAGER_ITEMS} />);
    expect(screen.getByText('Approvals')).toBeInTheDocument();
    expect(screen.getByText('Reconciliation')).toBeInTheDocument();
    expect(screen.queryByText('Budget Management')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit Log')).not.toBeInTheDocument();
  });

  it('renders the Controller-scoped items on top of Finance Manager capabilities', () => {
    render(<NavigationShell items={CONTROLLER_ITEMS} />);
    expect(screen.getByText('Approvals')).toBeInTheDocument();
    expect(screen.getByText('Reconciliation')).toBeInTheDocument();
    expect(screen.getByText('Budget Management')).toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('renders with no ThemeProvider or AppShell ancestor', () => {
    expect(() => render(<NavigationShell items={EMPLOYEE_ITEMS} />)).not.toThrow();
  });

  it('marks the item matching activeId as active and calls onNavigate with its id', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <NavigationShell
        items={FINANCE_MANAGER_ITEMS}
        activeId="approvals"
        onNavigate={onNavigate}
      />,
    );

    expect(screen.getByRole('button', { name: 'Approvals' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(screen.getByRole('button', { name: 'Reconciliation' }));
    expect(onNavigate).toHaveBeenCalledWith('reconciliation');
  });

  it('removes now-unauthorized items when re-rendered with a smaller list (mid-session role downgrade)', () => {
    const { rerender } = render(<NavigationShell items={FINANCE_MANAGER_ITEMS} />);
    expect(screen.getByText('Approvals')).toBeInTheDocument();

    rerender(<NavigationShell items={EMPLOYEE_ITEMS} />);
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.getByText('My Expenses')).toBeInTheDocument();
  });
});
