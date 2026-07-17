import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTheme } from '@clearline/design-tokens';
import { Icon } from '../../foundations/Icon';
import { Outlet } from 'react-router';
import { Container } from '../../atoms/Container';
import { SegmentedControl } from '../../atoms/SegmentedControl';
import { Text } from '../../atoms/Text';
import { NavigationShell, type NavigationShellItem } from '../NavigationShell';
import { SidebarFooter, type SidebarIdentity } from '../SidebarFooter';

export interface AppShellProps {
  navItems: NavigationShellItem[];
  activeNavId?: string;
  onNavigate?: (id: string) => void;
  title?: string;
  maxWidth?: number;
  /** Full-width strip rendered above the page content in the content column — e.g. the access-changed notice (US-CW-006 AC-05). */
  banner?: ReactNode;
  /** The signed-in user's identity for the rail footer (US-CW-032). Undefined while the session resolves. */
  identity?: SidebarIdentity;
  /** True while the session is still loading — renders the footer's placeholder instead of a wrong-identity flash. */
  identityLoading?: boolean;
}

/** Tabbable elements inside a container, in DOM order — used to trap focus within the open mobile drawer. */
function focusableWithin(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function Brand({ size = 19 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.25">
      <Icon name="logo" size={size} className="text-cl-accent" />
      <Text as="span" size="heading" className="tracking-tight">
        Clearline
      </Text>
    </div>
  );
}

/**
 * A layout-route component — mount it on a parent `<Route>` and nest page routes under it, so each
 * page renders into the `<Outlet/>` below without wrapping itself in `<AppShell>`. Assumes a
 * `<ThemeProvider>` ancestor (mounted once at the app root) rather than owning one itself, so theme
 * state stays shared across the whole app instead of being re-created per AppShell instance.
 *
 * Lays the app out as a persistent left sidebar rail (brand · role-scoped vertical nav · footer with
 * the relocated theme control and the user-identity block) beside a scrollable content column
 * (design §3.1 / US-CW-032). On narrow viewports the rail collapses behind a hamburger into an
 * off-canvas drawer so page content is never stranded (AC-07).
 */
export function AppShell({
  navItems,
  activeNavId,
  onNavigate,
  title,
  maxWidth = 1200,
  banner,
  identity,
  identityLoading,
}: AppShellProps) {
  const { theme, setTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const railRef = useRef<HTMLElement>(null);

  // Restore focus to the trigger when the drawer closes, so keyboard focus never lands on a hidden
  // rail — pair with the effect below that moves focus into the drawer on open.
  const closeDrawer = () => {
    setDrawerOpen(false);
    openButtonRef.current?.focus();
  };

  // On open, move focus into the drawer (its close control) so a keyboard user starts inside the
  // off-canvas rail rather than behind it.
  useEffect(() => {
    if (drawerOpen) closeButtonRef.current?.focus();
  }, [drawerOpen]);

  // Dismiss the mobile drawer on Escape, matching the app's other overlay dismissals.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  // While the drawer is open (mobile only — it's the desktop rail otherwise), trap Tab within it so
  // focus can't escape to the page behind the overlay.
  const handleRailKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!drawerOpen || event.key !== 'Tab') return;
    const focusable = focusableWithin(railRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Navigating from the drawer should close it, so the user lands on the page they picked.
  const handleNavigate = (id: string) => {
    onNavigate?.(id);
    closeDrawer();
  };

  const railPosition = drawerOpen
    ? 'fixed inset-y-0 left-0 z-50 flex md:sticky md:top-0 md:z-auto'
    : 'hidden md:sticky md:top-0 md:flex';

  return (
    <div className="bg-cl-bg text-cl-text flex min-h-screen font-sans text-sm leading-relaxed">
      <aside
        ref={railRef}
        onKeyDown={handleRailKeyDown}
        className={`bg-cl-surface border-cl-border w-53 shrink-0 flex-col overflow-y-auto border-r px-3 py-4 md:h-screen ${railPosition}`}
      >
        <div className="mb-4 flex items-center justify-between px-2 py-1">
          <Brand />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            aria-label="Close navigation"
            className="focus-visible:ring-cl-focus text-cl-text-2 -m-1 cursor-pointer rounded-lg p-1 outline-none focus-visible:ring-3 md:hidden"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <NavigationShell items={navItems} activeId={activeNavId} onNavigate={handleNavigate} />

        <div className="mt-auto flex flex-col gap-2.5 pt-3">
          <SegmentedControl
            options={['Light', 'Dark']}
            value={theme === 'dark' ? 'Dark' : 'Light'}
            onChange={(next) => setTheme(next === 'Dark' ? 'dark' : 'light')}
            fullWidth
          />
          <SidebarFooter identity={identity} loading={identityLoading} />
        </div>
      </aside>

      {drawerOpen ? (
        <div
          aria-hidden="true"
          onClick={closeDrawer}
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-cl-border bg-cl-surface flex items-center gap-3 border-b px-4 py-3 md:hidden">
          <button
            ref={openButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            className="focus-visible:ring-cl-focus text-cl-text-2 -m-1 cursor-pointer rounded-lg p-1 outline-none focus-visible:ring-3"
          >
            <Icon name="menu" size={20} />
          </button>
          <Brand size={18} />
        </div>

        {banner}

        <Container width={maxWidth} className="pt-9 pb-24">
          {title ? (
            <Text as="h1" size="title" className="mb-6">
              {title}
            </Text>
          ) : null}
          <Outlet />
        </Container>
      </div>
    </div>
  );
}
