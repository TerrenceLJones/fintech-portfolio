import { useTheme } from '@fintech-portfolio/design-tokens';
import { Icon } from '@fintech-portfolio/icons';
import { Outlet } from 'react-router';
import { SegmentedControl } from '../../atoms/SegmentedControl';
import { Text } from '../../atoms/Text';
import { NavigationShell, type NavigationShellItem } from '../NavigationShell';

export interface AppShellProps {
  navItems: NavigationShellItem[];
  activeNavId?: string;
  onNavigate?: (id: string) => void;
  title?: string;
  maxWidth?: number;
}

/**
 * A layout-route component — mount it on a parent `<Route>` and nest page routes under it, so each
 * page renders into the `<Outlet/>` below without wrapping itself in `<AppShell>`. Assumes a
 * `<ThemeProvider>` ancestor (mounted once at the app root) rather than owning one itself, so theme
 * state stays shared across the whole app instead of being re-created per AppShell instance.
 */
export function AppShell({ navItems, activeNavId, onNavigate, title, maxWidth = 1200 }: AppShellProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="bg-cl-bg text-cl-text min-h-screen font-sans text-sm leading-relaxed">
      <header className="bg-cl-surface/86 border-cl-border sticky top-0 z-30 flex items-center justify-between border-b px-8 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.75">
            <Icon name="logo" size={22} className="text-cl-accent" />
            <Text as="span" size="heading" className="tracking-tight">
              Clearline
            </Text>
          </div>
          <NavigationShell items={navItems} activeId={activeNavId} onNavigate={onNavigate} />
        </div>
        <SegmentedControl
          options={['Light', 'Dark']}
          value={theme === 'dark' ? 'Dark' : 'Light'}
          onChange={(next) => setTheme(next === 'Dark' ? 'dark' : 'light')}
        />
      </header>
      <div className="mx-auto px-8 pt-9 pb-24" style={{ maxWidth }}>
        {title ? (
          <Text as="h1" size="title" className="mb-6">
            {title}
          </Text>
        ) : null}
        <Outlet />
      </div>
    </div>
  );
}
