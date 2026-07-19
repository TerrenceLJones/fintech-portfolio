import type { Permission, SettingsSectionSlug } from '@clearline/contracts';
import { Navigate, Route } from 'react-router';
import { RequirePermission } from '../../routes/RequirePermission';
import { TeamPage } from '../team/TeamPage';
import { SettingsLayout } from './SettingsLayout';
import { SettingsSectionPlaceholder } from './SettingsSectionPlaceholder';
import { OrgSettingsSectionPlaceholder } from './OrgSettingsSectionPlaceholder';
import { SettingsNotFound } from './SettingsNotFound';
import { PersonalInfoPage } from './PersonalInfoPage';
import { NotificationsPage } from './NotificationsPage';

/** An Organization route wrapped in its RequirePermission guard, with the matching API path restated
 *  for the 403 line so the client denial and the server's independent 403 read the same (AC-04). The
 *  section body additionally probes the server so it degrades to AccessDenied on a 403 on its own. */
function orgRoute(slug: SettingsSectionSlug, title: string, permission: Permission) {
  return (
    <Route
      key={slug}
      element={
        <RequirePermission permission={permission} apiPath={`/api/settings/sections/${slug}`} />
      }
    >
      <Route path={slug} element={<OrgSettingsSectionPlaceholder slug={slug} title={title} />} />
    </Route>
  );
}

/**
 * The /settings route tree (US-CW-033), factored out of App.tsx so the app and the routing tests mount
 * exactly the same structure. SettingsLayout renders the role-scoped SettingsNav; the Profile group is
 * universal (no guard) and each Organization route is individually permission-guarded. Team & Members
 * is intentionally absent — it's the top-level /team page (US-CW-031); a /settings/team deep-link falls
 * through to the in-shell not-found.
 */
export function settingsRoutes() {
  return (
    <Route path="/settings" element={<SettingsLayout />}>
      <Route index element={<Navigate to="personal" replace />} />
      {/* Profile group — every authenticated user. */}
      <Route path="personal" element={<PersonalInfoPage />} />
      <Route path="security" element={<SettingsSectionPlaceholder title="Security" />} />
      <Route path="notifications" element={<NotificationsPage />} />
      {/* Organization group — Controller/Admin/Owner org-config. */}
      {orgRoute('company', 'Company Profile', 'org-profile:manage')}
      {/* Team & Members — the US-CW-031 team surface relocated into Settings; gated by team:view
        (Owner or Admin) and backed by its own /api/team/members endpoint, not a placeholder. */}
      <Route element={<RequirePermission permission="team:view" apiPath="/api/team/members" />}>
        <Route path="team" element={<TeamPage />} />
      </Route>
      {orgRoute('approval-policies', 'Approval Policies', 'policies:manage')}
      {orgRoute('spend-controls', 'Spend Controls', 'policies:manage')}
      {orgRoute('card-program', 'Card Program', 'card-program:manage')}
      {orgRoute('connected-accounts', 'Connected Accounts', 'bank-accounts:manage')}
      {orgRoute('integrations', 'Integrations', 'integrations:manage')}
      {orgRoute('org-notifications', 'Notifications', 'integrations:manage')}
      {/* Organization group — Admin/Owner only. */}
      {orgRoute('security-compliance', 'Security & Compliance', 'org-security:manage')}
      {orgRoute('developer', 'Developer', 'developer:manage')}
      {orgRoute('billing', 'Billing & Plan', 'billing:manage')}
      {/* Unknown /settings/{slug} — in-shell not-found (incl. a /settings/team deep-link). */}
      <Route path="*" element={<SettingsNotFound />} />
    </Route>
  );
}
