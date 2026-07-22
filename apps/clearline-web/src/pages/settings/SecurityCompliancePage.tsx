import { useNavigate } from 'react-router';
import { AccessDenied, Text } from '@clearline/ui';
import { OrgSecurityForbiddenError, useOrgSecurity } from '@clearline/data-access-org-security';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { ToastViewport } from '../../components/ToastViewport';
import { useToast } from '../../hooks/useToast';
import { DEFAULT_SETTINGS_SLUG, settingsPathForSlug } from '../../rbac/settings-sections';
import { securityComplianceBeacon } from './security-compliance.beacon';
import { SsoConfigCard } from './security-compliance/SsoConfigCard';
import { TwoFactorEnforcementCard } from './security-compliance/TwoFactorEnforcementCard';
import { IdleTimeoutCard } from './security-compliance/IdleTimeoutCard';
import { IpAllowlistCard } from './security-compliance/IpAllowlistCard';

/**
 * Settings → Security & Compliance (US-CW-040). An Admin/Owner-only surface configuring org-wide
 * security controls: SSO/SAML with a passing-test gate (AC-01/02), org-wide mandatory 2FA (AC-03/04),
 * the idle session-timeout (AC-05), and a CIDR IP allowlist with a self-lockout guard (AC-06/07/08).
 * Gated by `org-security:manage` — the data endpoint returns 403 independently and the page degrades to
 * AccessDenied (AC-09). Every change is audited server-side, never storing IdP certificate material (AC-10).
 */
export function SecurityCompliancePage() {
  useDemoBeacon(securityComplianceBeacon);
  const navigate = useNavigate();
  const query = useOrgSecurity();
  const { toast, show: showToast } = useToast(4000);

  if (query.error instanceof OrgSecurityForbiddenError) {
    return (
      <AccessDenied
        message="Ask an admin if you need it. This settings section is available to a different role."
        requestLine="403 Forbidden · GET /api/org-security"
        actionLabel="Back to Personal Info"
        onAction={() => navigate(settingsPathForSlug(DEFAULT_SETTINGS_SLUG))}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Text as="h2" size="heading">
          Security &amp; Compliance
        </Text>
        <Text as="p" size="label" tone="muted" className="mt-1">
          Organization-wide security controls. High-impact changes are confirmed and guarded against
          locking your organization — or yourself — out.
        </Text>
      </div>

      {query.isPending || !query.data ? (
        <Text as="p" tone="muted">
          Loading security settings…
        </Text>
      ) : (
        <>
          <SsoConfigCard posture={query.data} onToast={showToast} />
          <TwoFactorEnforcementCard posture={query.data} onToast={showToast} />
          <IdleTimeoutCard posture={query.data} onToast={showToast} />
          <IpAllowlistCard posture={query.data} onToast={showToast} />
        </>
      )}

      <ToastViewport toast={toast} />
    </div>
  );
}
