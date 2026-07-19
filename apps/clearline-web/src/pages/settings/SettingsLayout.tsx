import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import type { SettingsSectionSlug } from '@clearline/contracts';
import { SettingsNav } from '@clearline/ui';
import { useAccessChanged, useAuthorization } from '@clearline/data-access-auth';
import { useDemoBeacon } from '@clearline/demo-beacon';
import {
  DEFAULT_SETTINGS_SLUG,
  isSettingsSlugAuthorized,
  settingsGroupsForPermissions,
  settingsPathForSlug,
  settingsSlugForPath,
} from '../../rbac/settings-sections';
import { useGuardedNavigate } from '../../hooks/navigation-guard-context';
import { settingsBeacon } from './settings.beacon';

/**
 * The /settings shell (US-CW-033): the role-scoped two-tier SettingsNav beside the section content,
 * mounted inside the persistent AppShell (US-CW-032). SettingsNav is filtered by the live permission
 * set — the Organization group is simply absent for an Employee (AC-02), never disabled. Selecting a
 * section navigates within the shell (no reload) to a deep-linkable /settings/{slug} URL (AC-05).
 *
 * AC-06: when a mid-session access change removes the section being viewed, the user is moved to
 * Personal Info (a universal section) and the app-wide "Your access changed" banner (AppChrome) does
 * the notice. This fires only on an actual downgrade (useAccessChanged) — a fresh deep-link with no
 * prior access is not a change and is handled by the route's RequirePermission → AccessDenied (AC-04).
 */
export function SettingsLayout() {
  useDemoBeacon(settingsBeacon);
  const { can } = useAuthorization();
  const { accessChanged } = useAccessChanged();
  const location = useLocation();
  const navigate = useNavigate();
  // SettingsNav clicks pass through the unsaved-changes guard (AC-02); the forced access-downgrade
  // redirect below stays on plain navigate — it must not be blockable.
  const guardedNavigate = useGuardedNavigate();

  const groups = settingsGroupsForPermissions(can);
  const activeSlug = settingsSlugForPath(location.pathname);
  const activeAuthorized = activeSlug ? isSettingsSlugAuthorized(activeSlug, can) : true;

  useEffect(() => {
    if (accessChanged && activeSlug && !activeAuthorized) {
      navigate(settingsPathForSlug(DEFAULT_SETTINGS_SLUG), { replace: true });
    }
  }, [accessChanged, activeSlug, activeAuthorized, navigate]);

  return (
    <div className="flex flex-col gap-8 md:flex-row md:gap-10">
      <SettingsNav
        groups={groups}
        activeId={activeSlug}
        onNavigate={(id) => guardedNavigate(settingsPathForSlug(id as SettingsSectionSlug))}
      />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
