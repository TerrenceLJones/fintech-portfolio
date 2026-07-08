import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Alert, AppShell } from '@clearline/ui';
import { useAccessChanged, useAuthorization } from '@clearline/data-access-auth';
import { NAV_ITEMS, navIdForPath, navItemsForPermissions, navPathForId } from './rbac/nav-items';
import { PageTitleSetterContext } from './hooks/page-title-context';

/**
 * The authenticated app shell, wired to the live role. It reads entitlements from useAuthorization
 * and renders only the nav links the role authorizes (US-CW-006 / US-CW-028) — the presentational
 * NavigationShell inside AppShell stays unaware of roles. A mid-session role change flows through
 * useAuthorization on the next session refetch, re-rendering the nav, while useAccessChanged raises
 * the "your access changed" banner (AC-05). Individual routes are still independently guarded by
 * RequirePermission; this only decides what's *shown*, never what's *allowed*.
 *
 * The page heading defaults to the active section's nav label, but a page can override it (and, in
 * lockstep, the browser tab) through usePageTitle for a data-derived title — e.g. US-CW-015's Spend
 * Analytics Dashboard. Resolving both surfaces from one value here keeps the tab and heading in sync.
 */
export function AppChrome() {
  const { can } = useAuthorization();
  const { accessChanged, dismiss } = useAccessChanged();
  const location = useLocation();
  const navigate = useNavigate();

  const [titleOverride, setTitleOverride] = useState<string>();

  const navItems = navItemsForPermissions(can);
  const activeNavId = navIdForPath(location.pathname);
  const navLabel = NAV_ITEMS.find((item) => item.id === activeNavId)?.label;
  const title = titleOverride ?? navLabel;

  useEffect(() => {
    document.title = title ? `${title} · Clearline` : 'Clearline';
  }, [title]);

  const banner = accessChanged ? (
    // role="status" (implicit aria-live=polite) so a mid-session downgrade is announced to screen
    // readers without stealing focus — the banner is a dynamic notice, not part of the initial page.
    <div role="status" className="px-8 pt-4">
      <Alert
        tone="warning"
        title="Your access changed. Some features may no longer be available."
        action="Dismiss"
        onAction={dismiss}
      />
    </div>
  ) : undefined;

  return (
    <PageTitleSetterContext.Provider value={setTitleOverride}>
      <AppShell
        navItems={navItems}
        activeNavId={activeNavId}
        onNavigate={(id) => {
          const path = navPathForId(id);
          if (path) navigate(path);
        }}
        title={title}
        banner={banner}
      />
    </PageTitleSetterContext.Provider>
  );
}
