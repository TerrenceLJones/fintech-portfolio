import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ThemeProvider } from '@clearline/design-tokens';
import { AppShell, type AppShellProps } from './AppShell';
import { buildNavItem } from '../../test-factories';

const NAV_ITEMS = [buildNavItem(), buildNavItem({ id: 'cards', icon: 'copy', label: 'My Cards' })];

const IDENTITY = {
  name: 'Marcus Okafor',
  initials: 'MO',
  roleLabel: 'Finance Manager',
  detail: '$10k limit',
};

function renderAppShell(props: Partial<AppShellProps> = {}, pageContent = <div>Page content</div>) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShell navItems={NAV_ITEMS} {...props} />}>
            <Route index element={pageContent} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('AppShell', () => {
  it('renders the matched child route inside the shell', () => {
    renderAppShell({ title: 'Spend Dashboard' });
    expect(screen.getByText('Page content')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spend Dashboard' })).toBeInTheDocument();
  });

  it('renders its nav items in the sidebar rail as a single labelled nav landmark (AC-08)', () => {
    renderAppShell();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toHaveClass('flex-col');
    expect(screen.getByRole('button', { name: 'My Expenses' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Cards' })).toBeInTheDocument();
  });

  it('renders the user-identity footer from the identity prop (AC-04)', () => {
    renderAppShell({ identity: IDENTITY });
    expect(screen.getByText('Marcus Okafor')).toBeInTheDocument();
    expect(screen.getByText('Finance Manager · $10k limit')).toBeInTheDocument();
  });

  it('shows the relocated Light/Dark control in the rail and drives the document theme (AC-05)', async () => {
    const user = userEvent.setup();
    renderAppShell();

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles the off-canvas nav drawer on narrow viewports (AC-07)', async () => {
    const user = userEvent.setup();
    renderAppShell({ identity: IDENTITY });

    const open = screen.getByRole('button', { name: 'Open navigation' });
    expect(open).toHaveAttribute('aria-expanded', 'false');

    await user.click(open);
    expect(open).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Close navigation' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(open).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the drawer on Escape (AC-08 keyboard operability)', async () => {
    const user = userEvent.setup();
    renderAppShell({ identity: IDENTITY });

    const open = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(open);
    expect(open).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(open).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders the footer placeholder while the session is still loading (edge case)', () => {
    renderAppShell({ identityLoading: true });
    expect(screen.getByTestId('sidebar-footer-loading')).toBeInTheDocument();
  });

  it('moves focus into the drawer on open and restores it to the trigger on close (AC-08)', async () => {
    const user = userEvent.setup();
    renderAppShell({ identity: IDENTITY });

    const open = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(open);
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(open).toHaveFocus();
  });

  it('traps Tab within the open drawer (AC-08)', async () => {
    const user = userEvent.setup();
    renderAppShell({ identity: IDENTITY });

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));

    // Tab off the last focusable (the Dark theme option) wraps back to the first (Close navigation).
    screen.getByRole('button', { name: 'Dark' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
  });

  it('closes the drawer after navigating from it', async () => {
    const user = userEvent.setup();
    renderAppShell({ identity: IDENTITY });

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('button', { name: 'My Cards' }));

    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('requires a ThemeProvider ancestor rather than creating its own', () => {
    expect(() =>
      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<AppShell navItems={NAV_ITEMS} />}>
              <Route index element={<div>content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      ),
    ).toThrow('useTheme must be used within a <ThemeProvider>');
  });
});
