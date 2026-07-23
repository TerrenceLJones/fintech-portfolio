import type { Permission, SettingsSectionSlug } from '@clearline/contracts';
import { Navigate, Route } from 'react-router';
import { RequirePermission } from '../../routes/RequirePermission';
import { TeamPage } from '../team/TeamPage';
import { SettingsLayout } from './SettingsLayout';
import { OrgSettingsSectionPlaceholder } from './OrgSettingsSectionPlaceholder';
import { SettingsNotFound } from './SettingsNotFound';
import { PersonalInfoPage } from './PersonalInfoPage';
import { NotificationsPage } from './NotificationsPage';
import { SecurityPage } from './SecurityPage';
import { CompanyProfilePage } from './CompanyProfilePage';
import { ApprovalPoliciesPage } from './ApprovalPoliciesPage';
import { SpendControlsPage } from './SpendControlsPage';
import { CardProgramPage } from './CardProgramPage';
import { ConnectedAccountsPage } from './ConnectedAccountsPage';
import { IntegrationsPage } from './IntegrationsPage';
import { OrgNotificationsPage } from './OrgNotificationsPage';
import { SecurityCompliancePage } from './SecurityCompliancePage';
import { DeveloperSettingsPage } from './DeveloperSettingsPage';

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
      <Route path="security" element={<SecurityPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      {/* Organization group — Controller/Admin/Owner org-config. Company Profile is a real page
        (US-CW-036), guarded by org-profile:manage; the page itself re-probes the server so it still
        degrades to AccessDenied on an independent 403 (AC-03). */}
      <Route
        element={
          <RequirePermission
            permission="org-profile:manage"
            apiPath="/api/settings/sections/company"
          />
        }
      >
        <Route path="company" element={<CompanyProfilePage />} />
      </Route>
      {/* Team & Members — the US-CW-031 team surface relocated into Settings; gated by team:view
        (Owner or Admin) and backed by its own /api/team/members endpoint, not a placeholder. */}
      <Route element={<RequirePermission permission="team:view" apiPath="/api/team/members" />}>
        <Route path="team" element={<TeamPage />} />
      </Route>
      {/* Approval Policies & Spend Controls are real pages (US-CW-037), gated by policies:manage; each
        page re-probes the server so it degrades to AccessDenied on an independent 403 (AC-09). */}
      <Route
        element={
          <RequirePermission
            permission="policies:manage"
            apiPath="/api/settings/sections/approval-policies"
          />
        }
      >
        <Route path="approval-policies" element={<ApprovalPoliciesPage />} />
      </Route>
      <Route
        element={
          <RequirePermission
            permission="policies:manage"
            apiPath="/api/settings/sections/spend-controls"
          />
        }
      >
        <Route path="spend-controls" element={<SpendControlsPage />} />
      </Route>
      {/* Card Program & Connected Accounts are real pages (US-CW-038); each page re-probes the server so
        it degrades to AccessDenied on an independent 403 (AC-09). */}
      <Route
        element={
          <RequirePermission
            permission="card-program:manage"
            apiPath="/api/settings/sections/card-program"
          />
        }
      >
        <Route path="card-program" element={<CardProgramPage />} />
      </Route>
      <Route
        element={
          <RequirePermission
            permission="bank-accounts:manage"
            apiPath="/api/settings/sections/connected-accounts"
          />
        }
      >
        <Route path="connected-accounts" element={<ConnectedAccountsPage />} />
      </Route>
      {/* Integrations & Organization Notifications are real pages (US-CW-039), gated by
        integrations:manage; each page re-probes the server so it degrades to AccessDenied on an
        independent 403 (AC-09). */}
      <Route
        element={
          <RequirePermission
            permission="integrations:manage"
            apiPath="/api/settings/sections/integrations"
          />
        }
      >
        <Route path="integrations" element={<IntegrationsPage />} />
      </Route>
      <Route
        element={
          <RequirePermission
            permission="integrations:manage"
            apiPath="/api/settings/sections/org-notifications"
          />
        }
      >
        <Route path="org-notifications" element={<OrgNotificationsPage />} />
      </Route>
      {/* Organization group — Admin/Owner only. Security & Compliance is a real page (US-CW-040); the
        page re-probes the server so it degrades to AccessDenied on an independent 403 (AC-09). */}
      <Route
        element={
          <RequirePermission
            permission="org-security:manage"
            apiPath="/api/settings/sections/security-compliance"
          />
        }
      >
        <Route path="security-compliance" element={<SecurityCompliancePage />} />
      </Route>
      {/* Developer is a real page (US-CW-041), Admin/Owner-only; the page re-probes the server so it
        degrades to AccessDenied on an independent 403 (AC-10). */}
      <Route
        element={
          <RequirePermission
            permission="developer:manage"
            apiPath="/api/settings/sections/developer"
          />
        }
      >
        <Route path="developer" element={<DeveloperSettingsPage />} />
      </Route>
      {orgRoute('billing', 'Billing & Plan', 'billing:manage')}
      {/* Unknown /settings/{slug} — in-shell not-found (incl. a /settings/team deep-link). */}
      <Route path="*" element={<SettingsNotFound />} />
    </Route>
  );
}
