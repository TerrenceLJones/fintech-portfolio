/**
 * Organization Security & Compliance, managed in Settings → Security & Compliance (US-CW-040). An
 * Admin or Owner configures org-wide security controls: SSO/SAML single sign-on, mandatory 2FA for all
 * members, the idle session-timeout duration, and an IP allowlist. Gated by `org-security:manage`
 * (Admin | Owner only) — hidden even from a bare Controller, and every route re-checks server-side.
 *
 * Every high-blast-radius control carries a guardrail: SSO cannot be enabled until a connection test
 * passes (the raw IdP certificate is never persisted — only a fingerprint), and an IP allowlist save
 * that would exclude the acting admin's own current IP is refused with the IP named (self-lockout
 * protection, AC-07). No state is ever conveyed by colour alone; SSO/test status always carries text.
 */

/** The idle session-timeout options an org can choose (AC-05). Minutes of inactivity before auto-logoff. */
export type IdleTimeoutMinutes = 15 | 30 | 60 | 240 | 480;

/** The outcome of a mocked SAML connection test (AC-01) — never colour-only, always paired with text. */
export type SsoTestResult = 'passed' | 'failed';

/**
 * The org's SSO/SAML configuration as returned to the client (AC-01/02). The uploaded IdP certificate
 * is NEVER echoed back — only `certificateFingerprint`, a short non-secret digest, is exposed so the
 * admin can confirm which cert is on file. `enabled` can only be true once `lastTest` passed.
 */
export interface SsoConfig {
  metadataUrl: string | null;
  entityId: string | null;
  /** Short digest of the uploaded certificate (e.g. "a1b2c3d4") — never the certificate itself (AC-10). */
  certificateFingerprint: string | null;
  /** The most recent connection-test outcome; null if never tested. The Enable toggle is inert until this passed (AC-01). */
  lastTest: { result: SsoTestResult; reason: string | null } | null;
  enabled: boolean;
}

/** GET /api/org-security — the full org security posture for the Security & Compliance page. */
export interface OrgSecurityResponse {
  sso: SsoConfig;
  requireTwoFactor: boolean;
  idleTimeoutMinutes: IdleTimeoutMinutes;
  ipAllowlist: string[];
  /** The acting admin's current IP, so the client can pre-flight the self-lockout guard (AC-06/07). */
  currentIp: string;
}

/** POST /api/org-security/sso/test — enters config and runs a mocked SAML handshake (AC-01). */
export interface TestSsoRequest {
  metadataUrl: string;
  entityId: string;
  /** The uploaded IdP certificate (PEM). Used only to verify the handshake; stored only as a fingerprint (AC-10). */
  certificate: string;
}

/** The connection-test result — a specific reason on failure so the admin can fix it (AC-01). */
export interface TestSsoResponse {
  result: SsoTestResult;
  reason: string | null;
  sso: SsoConfig;
}

/** POST /api/org-security/sso/enabled — flip SSO on/off. Enabling requires a passed test (AC-02). */
export interface SetSsoEnabledRequest {
  enabled: boolean;
}

/** POST /api/org-security/two-factor — enforce or relax org-wide mandatory 2FA (AC-03). */
export interface SetTwoFactorEnforcementRequest {
  requireTwoFactor: boolean;
}

/** POST /api/org-security/idle-timeout — change the org idle auto-logoff duration (AC-05). */
export interface SetIdleTimeoutRequest {
  idleTimeoutMinutes: IdleTimeoutMinutes;
}

/** POST /api/org-security/ip-allowlist — add a CIDR range to the allowlist (AC-06/07). */
export interface AddIpRangeRequest {
  cidr: string;
}

/** DELETE /api/org-security/ip-allowlist — remove a CIDR range (AC-08). */
export interface RemoveIpRangeRequest {
  cidr: string;
}

/** Response carrying the updated posture after any org-security mutation. */
export interface OrgSecurityMutationResponse {
  sso: SsoConfig;
  requireTwoFactor: boolean;
  idleTimeoutMinutes: IdleTimeoutMinutes;
  ipAllowlist: string[];
  currentIp: string;
}

export type OrgSecurityErrorCode =
  | 'forbidden_role'
  | 'unauthenticated'
  | 'sso_test_required'
  | 'invalid_cidr'
  | 'self_lockout'
  | 'invalid_timeout'
  | 'duplicate_range'
  | 'unknown_range';

/** Body of a 4xx from an org-security endpoint. `detail` names the specific thing (e.g. the excluded IP). */
export interface OrgSecurityErrorResponse {
  error: OrgSecurityErrorCode;
  detail?: string;
}
