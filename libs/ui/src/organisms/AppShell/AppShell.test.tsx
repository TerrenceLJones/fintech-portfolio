import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ThemeProvider } from '@fintech-portfolio/design-tokens';
import { AppShell, type AppShellProps } from './AppShell';
import { buildNavItem } from '../../test-factories';

const NAV_ITEMS = [buildNavItem(), buildNavItem({ id: 'cards', icon: 'copy', label: 'My Cards' })];

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
    expect(screen.getByText('Spend Dashboard')).toBeInTheDocument();
  });

  it('renders its nav items in the header', () => {
    renderAppShell();
    expect(screen.getByRole('button', { name: 'My Expenses' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Cards' })).toBeInTheDocument();
  });

  it('toggles the document theme via the Light/Dark control', async () => {
    const user = userEvent.setup();
    renderAppShell();

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
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
