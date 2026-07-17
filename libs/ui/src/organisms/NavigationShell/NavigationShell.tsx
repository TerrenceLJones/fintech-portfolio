import type { IconName } from '@clearline/icons';
import { NavItem } from '../../molecules/NavItem';

export interface NavigationShellItem {
  id: string;
  icon: IconName;
  label: string;
  badge?: string;
}

export interface NavigationShellProps {
  items: NavigationShellItem[];
  activeId?: string;
  onNavigate?: (id: string) => void;
}

/**
 * Renders exactly the nav items it's given — role-scoped filtering happens upstream (see US-CW-006),
 * this component just presents the resulting list. No ThemeProvider/AppShell dependency, so it can be
 * dropped into any layout or tested/Storybook'd standalone.
 */
export function NavigationShell({ items, activeId, onNavigate }: NavigationShellProps) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.75">
      {items.map((item) => (
        <NavItem
          key={item.id}
          icon={item.icon}
          label={item.label}
          badge={item.badge}
          active={item.id === activeId}
          onClick={() => onNavigate?.(item.id)}
        />
      ))}
    </nav>
  );
}
