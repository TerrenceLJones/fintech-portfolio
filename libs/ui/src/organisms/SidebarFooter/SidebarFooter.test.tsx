import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('renders the avatar photo when one is set, replacing the initials (US-CW-034 AC-05)', () => {
    render(<SidebarFooter identity={{ ...IDENTITY, avatarUrl: 'data:image/png;base64,AAAA' }} />);
    const img = screen.getByRole('img', { name: 'Marcus Okafor' });
    expect(img).toHaveAttribute('src', 'data:image/png;base64,AAAA');
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

  it('stays a static block (no menu button) when no menu handlers are given', () => {
    render(<SidebarFooter identity={IDENTITY} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  describe('user menu (US-CW-048 / US-CW-032)', () => {
    it('exposes the identity as a menu trigger and reveals Manage account + Log out on open', async () => {
      const user = userEvent.setup();
      render(<SidebarFooter identity={IDENTITY} onLogout={vi.fn()} onManageAccount={vi.fn()} />);

      const trigger = screen.getByRole('button', { name: /marcus okafor/i });
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      // Menu items are not in the tree until opened.
      expect(screen.queryByRole('menuitem', { name: 'Log out' })).not.toBeInTheDocument();

      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('menuitem', { name: /manage account/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument();
    });

    it('invokes onManageAccount and onLogout when their items are chosen, and closes the menu', async () => {
      const user = userEvent.setup();
      const onLogout = vi.fn();
      const onManageAccount = vi.fn();
      render(
        <SidebarFooter identity={IDENTITY} onLogout={onLogout} onManageAccount={onManageAccount} />,
      );

      await user.click(screen.getByRole('button', { name: /marcus okafor/i }));
      await user.click(screen.getByRole('menuitem', { name: /manage account/i }));
      expect(onManageAccount).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /marcus okafor/i }));
      await user.click(screen.getByRole('menuitem', { name: 'Log out' }));
      expect(onLogout).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape and returns focus to the trigger (AC-01)', async () => {
      const user = userEvent.setup();
      render(<SidebarFooter identity={IDENTITY} onLogout={vi.fn()} onManageAccount={vi.fn()} />);
      const trigger = screen.getByRole('button', { name: /marcus okafor/i });

      await user.click(trigger);
      expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menuitem', { name: 'Log out' })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it('closes on an outside click (AC-01)', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <button type="button">outside</button>
          <SidebarFooter identity={IDENTITY} onLogout={vi.fn()} onManageAccount={vi.fn()} />
        </div>,
      );
      await user.click(screen.getByRole('button', { name: /marcus okafor/i }));
      expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'outside' }));
      expect(screen.queryByRole('menuitem', { name: 'Log out' })).not.toBeInTheDocument();
    });

    it('disables Log out while a sign-out is in flight so it cannot be double-submitted (AC-02)', async () => {
      const user = userEvent.setup();
      const onLogout = vi.fn();
      render(
        <SidebarFooter
          identity={IDENTITY}
          onLogout={onLogout}
          onManageAccount={vi.fn()}
          loggingOut
        />,
      );
      await user.click(screen.getByRole('button', { name: /marcus okafor/i }));
      const logout = screen.getByRole('menuitem', { name: /log out/i });
      expect(logout).toBeDisabled();
      await user.click(logout);
      expect(onLogout).not.toHaveBeenCalled();
    });
  });
});
