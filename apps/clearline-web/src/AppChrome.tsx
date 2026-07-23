import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Alert, AppShell, type SidebarIdentity } from '@clearline/ui';
import { useAccessChanged, useAuthorization, useLogout } from '@clearline/data-access-auth';
import { NAV_ITEMS, navIdForPath, navItemsForPermissions, navPathForId } from './rbac/nav-items';
import { identityDetail, initialsFromName, roleLabel } from './rbac/identity';
import { PageTitleSetterContext } from './hooks/page-title-context';
import { useGuardedNavigate } from './hooks/navigation-guard-context';

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
  const { can, role, isAdmin, approvalLimit, currency, displayName, avatarUrl, isLoading } =
    useAuthorization();
  const { accessChanged, dismiss } = useAccessChanged();
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  // Primary-nav clicks go through the unsaved-changes guard (US-CW-034 AC-02) so leaving a dirty
  // settings form warns first; it's a plain navigate outside the guard provider.
  const guardedNavigate = useGuardedNavigate();

  const [titleOverride, setTitleOverride] = useState<string>();

  const navItems = navItemsForPermissions(can);
  const activeNavId = navIdForPath(location.pathname);
  const navLabel = NAV_ITEMS.find((item) => item.id === activeNavId)?.label;
  const title = titleOverride ?? navLabel;

  useEffect(() => {
    document.title = title ? `${title} · Clearline` : 'Clearline';
  }, [title]);

  // The net-new sidebar identity footer (design §3.1 / US-CW-032) — read straight from the live
  // session; it presents who-am-I / what-can-I-approve and owns no authorization decision.
  const identity: SidebarIdentity | undefined =
    role && displayName
      ? {
          name: displayName,
          initials: initialsFromName(displayName),
          avatarUrl,
          roleLabel: roleLabel(role),
          detail: identityDetail(role, approvalLimit, isAdmin, currency ?? undefined),
        }
      : undefined;

  // Client-first teardown (US-CW-048 AC-05): fire the best-effort server revoke and redirect to login
  // regardless of its outcome — postLogout clears the in-memory token in its `finally`, so a failed or
  // offline call can never strand the user half-authenticated. RequireAuth is the fallback guard.
  const handleLogout = () => {
    logout.mutate();
    navigate('/login', { replace: true });
  };

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
          if (path) guardedNavigate(path);
        }}
        title={title}
        banner={banner}
        identity={identity}
        identityLoading={isLoading}
        onManageAccount={() => guardedNavigate('/settings/personal')}
        onLogout={handleLogout}
        loggingOut={logout.isPending}
      />
    </PageTitleSetterContext.Provider>
  );
}
