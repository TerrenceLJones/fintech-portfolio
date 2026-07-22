import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  AddIpRangeRequest,
  IdleTimeoutMinutes,
  OrgSecurityResponse,
  RemoveIpRangeRequest,
  SetSsoEnabledRequest,
  SetTwoFactorEnforcementRequest,
  TestSsoRequest,
  TestSsoResponse,
} from '@clearline/contracts';
import { ORG_SECURITY_QUERY_KEY } from './org-security-query-keys';

/** Thrown when the caller lacks org-security:manage — the page degrades to AccessDenied (AC-09). */
export class OrgSecurityForbiddenError extends Error {
  constructor() {
    super('org_security_forbidden');
    this.name = 'OrgSecurityForbiddenError';
  }
}

/** Carries the server's typed error code + status so a form can show the specific inline copy. */
export class OrgSecurityActionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    /** The specific thing the error names, e.g. the excluded IP for a self-lockout (AC-07). */
    public readonly detail?: string,
  ) {
    super(code);
    this.name = 'OrgSecurityActionError';
  }
}

async function getOrgSecurity(): Promise<OrgSecurityResponse> {
  const response = await authenticatedFetch('/api/org-security');
  if (response.status === 403) throw new OrgSecurityForbiddenError();
  if (!response.ok) throw new Error('org_security_fetch_failed');
  return response.json();
}

/** The org's full security posture — SSO, 2FA enforcement, idle-timeout, IP allowlist (AC-01–08). */
export function useOrgSecurity() {
  return useQuery({
    queryKey: ORG_SECURITY_QUERY_KEY,
    queryFn: getOrgSecurity,
    retry: false,
  });
}

async function send<T>(path: string, method: string, body: unknown): Promise<T> {
  const response = await authenticatedFetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
    };
    throw new OrgSecurityActionError(
      payload.error ?? 'request_failed',
      response.status,
      payload.detail,
    );
  }
  return response.json() as Promise<T>;
}

function useInvalidateOrgSecurity() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ORG_SECURITY_QUERY_KEY });
}

/** Enter SSO config + run the mocked SAML handshake (AC-01). Does not invalidate — returns the result. */
export function useTestSso() {
  const invalidate = useInvalidateOrgSecurity();
  return useMutation({
    mutationFn: (input: TestSsoRequest) =>
      send<TestSsoResponse>('/api/org-security/sso/test', 'POST', input),
    onSuccess: invalidate,
  });
}

/** Toggle SSO on/off (AC-02); enabling requires a passed test (server-enforced). */
export function useSetSsoEnabled() {
  const invalidate = useInvalidateOrgSecurity();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      send<OrgSecurityResponse>('/api/org-security/sso/enabled', 'POST', {
        enabled,
      } satisfies SetSsoEnabledRequest),
    onSuccess: invalidate,
  });
}

/** Enforce or relax org-wide mandatory 2FA (AC-03). */
export function useSetTwoFactorEnforcement() {
  const invalidate = useInvalidateOrgSecurity();
  return useMutation({
    mutationFn: (requireTwoFactor: boolean) =>
      send<OrgSecurityResponse>('/api/org-security/two-factor', 'POST', {
        requireTwoFactor,
      } satisfies SetTwoFactorEnforcementRequest),
    onSuccess: invalidate,
  });
}

/** Change the org idle auto-logoff duration (AC-05). */
export function useSetIdleTimeout() {
  const invalidate = useInvalidateOrgSecurity();
  return useMutation({
    mutationFn: (idleTimeoutMinutes: IdleTimeoutMinutes) =>
      send<OrgSecurityResponse>('/api/org-security/idle-timeout', 'POST', { idleTimeoutMinutes }),
    onSuccess: invalidate,
  });
}

/** Add a CIDR range to the IP allowlist (AC-06); server rejects a self-lockout (AC-07). */
export function useAddIpRange() {
  const invalidate = useInvalidateOrgSecurity();
  return useMutation({
    mutationFn: (cidr: string) =>
      send<OrgSecurityResponse>('/api/org-security/ip-allowlist', 'POST', {
        cidr,
      } satisfies AddIpRangeRequest),
    onSuccess: invalidate,
  });
}

/** Remove a CIDR range from the IP allowlist (AC-08). */
export function useRemoveIpRange() {
  const invalidate = useInvalidateOrgSecurity();
  return useMutation({
    mutationFn: (cidr: string) =>
      send<OrgSecurityResponse>('/api/org-security/ip-allowlist', 'DELETE', {
        cidr,
      } satisfies RemoveIpRangeRequest),
    onSuccess: invalidate,
  });
}
