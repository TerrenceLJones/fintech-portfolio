import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SettingsNav, type SettingsNavGroup } from './SettingsNav';

const PROFILE_GROUP: SettingsNavGroup = {
  id: 'profile',
  label: 'Profile',
  items: [
    { id: 'personal', label: 'Personal Info', href: '/settings/personal' },
    { id: 'security', label: 'Security', href: '/settings/security' },
    { id: 'notifications', label: 'Notifications', href: '/settings/notifications' },
  ],
};

const ORG_GROUP: SettingsNavGroup = {
  id: 'organization',
  label: 'Organization',
  items: [
    { id: 'company', label: 'Company Profile', href: '/settings/company' },
    { id: 'billing', label: 'Billing & Plan', href: '/settings/billing' },
  ],
};

describe('SettingsNav', () => {
  it('renders each group with an accessible group label', () => {
    render(<SettingsNav groups={[PROFILE_GROUP, ORG_GROUP]} activeId="personal" />);
    // Scope to the wide-viewport nav — the narrow <select>'s <optgroup>s are also role="group".
    const nav = screen.getByRole('navigation', { name: 'Settings' });
    expect(within(nav).getByRole('group', { name: 'Profile' })).toBeInTheDocument();
    expect(within(nav).getByRole('group', { name: 'Organization' })).toBeInTheDocument();
  });

  it('renders each item as a deep-linkable link carrying its href', () => {
    render(<SettingsNav groups={[PROFILE_GROUP]} activeId="personal" />);
    expect(screen.getByRole('link', { name: 'Security' })).toHaveAttribute(
      'href',
      '/settings/security',
    );
  });

  it('marks the active item with aria-current="page"', () => {
    render(<SettingsNav groups={[PROFILE_GROUP]} activeId="security" />);
    expect(screen.getByRole('link', { name: 'Security' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Personal Info' })).not.toHaveAttribute('aria-current');
  });

  it('intercepts a plain click for SPA navigation (preventDefault + onNavigate)', () => {
    const onNavigate = vi.fn();
    render(<SettingsNav groups={[PROFILE_GROUP]} activeId="personal" onNavigate={onNavigate} />);
    const link = screen.getByRole('link', { name: 'Security' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    fireEvent(link, event);
    expect(onNavigate).toHaveBeenCalledWith('security');
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets a modifier-click through (new tab) without intercepting', () => {
    const onNavigate = vi.fn();
    render(<SettingsNav groups={[PROFILE_GROUP]} activeId="personal" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('link', { name: 'Security' }), { metaKey: true });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does not render an Organization group when it is not supplied (client hides)', () => {
    render(<SettingsNav groups={[PROFILE_GROUP]} activeId="personal" />);
    expect(screen.queryByRole('group', { name: 'Organization' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Billing & Plan' })).not.toBeInTheDocument();
  });

  it('offers a labeled section menu that reflects the active section for narrow viewports', () => {
    render(<SettingsNav groups={[PROFILE_GROUP, ORG_GROUP]} activeId="billing" />);
    const menu = screen.getByRole('combobox', { name: /settings section/i });
    expect(menu).toHaveValue('billing');
  });

  it('navigates when the narrow-viewport menu changes', () => {
    const onNavigate = vi.fn();
    render(
      <SettingsNav
        groups={[PROFILE_GROUP, ORG_GROUP]}
        activeId="personal"
        onNavigate={onNavigate}
      />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: /settings section/i }), {
      target: { value: 'company' },
    });
    expect(onNavigate).toHaveBeenCalledWith('company');
  });
});
