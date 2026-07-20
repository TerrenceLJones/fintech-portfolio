/**
 * The account-security surface (EPIC-CW-022 / US-CW-035): a user's own password change, authenticator-app
 * two-factor setup with one-time backup codes, active-session management, and trusted-device removal.
 * Every field here is self-managed — the Security page is in the Profile group and requires no permission;
 * the server authorizes purely by the caller's own session. All of it is mocked through the MSW service
 * layer (no production identity provider). This file owns only the shared wire types; the TOTP crypto is
 * @clearline/domain-auth and the seeded device/session state lives in the mock backend.
 */

// ── Password change (AC-01/02) ─────────────────────────────────────────────

/**
 * POST /api/security/password — change the signed-in user's password. Unlike a password *reset*
 * (US-CW-003), a self-service change does NOT revoke the caller's other sessions: changing your password
 * from Settings is not a compromise signal (AC-01).
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export type ChangePasswordErrorCode =
  /** The supplied current password did not match — the field is cleared, new-password kept (AC-02). */
  | 'incorrect_password'
  /** The new password is below the strength bar (>= 12 chars, mixed case, number, symbol) (AC-02). */
  | 'weak_password';

export interface ChangePasswordErrorResponse {
  error: ChangePasswordErrorCode;
}

export interface ChangePasswordResponse {
  ok: true;
}

// ── Two-factor authentication (AC-03/04/05/06/07) ──────────────────────────

/** GET /api/security/two-factor — whether 2FA is on, and whether the org mandates it (AC-07, US-CW-040). */
export interface TwoFactorStatus {
  enabled: boolean;
  /**
   * True when the organization enforces 2FA: the "Disable" control is not rendered and the user sees the
   * admin-contact message instead (AC-07). Backed by an org flag seeded here until US-CW-040 owns it.
   */
  orgEnforced: boolean;
}

/**
 * POST /api/security/two-factor/setup — begin setup. The server mints the secret and returns it once,
 * along with the `otpauth://` URI the client renders as a QR locally (AC-03). The secret is held pending
 * server-side and is NOT active until a correct code is verified (AC-05).
 */
export interface StartTotpSetupResponse {
  /** Base32 shared secret, shown as the copyable manual-entry code (AC-03). */
  secret: string;
  /** The `otpauth://totp/...` URI — rendered to a client-side SVG QR, never sent to an image service (AC-03). */
  otpauthUri: string;
}

/** POST /api/security/two-factor/verify — submit a 6-digit code to complete setup (AC-04/05). */
export interface VerifyTotpSetupRequest {
  code: string;
}

export type VerifyTotpSetupErrorCode =
  /** Wrong code — setup cannot complete, the secret stays unverified, the user remains on step 2 (AC-05). */
  | 'incorrect_code'
  /** No pending setup to verify (e.g. the flow was abandoned/expired) — restart required. */
  | 'no_pending_setup';

export interface VerifyTotpSetupErrorResponse {
  error: VerifyTotpSetupErrorCode;
}

/**
 * 200 body on successful verification — the ten one-time backup codes, shown EXACTLY ONCE (AC-04). Only
 * their hashes are retained server-side; there is no endpoint to re-reveal or regenerate them (AC-06).
 */
export interface VerifyTotpSetupResponse {
  backupCodes: string[];
}

/** POST /api/security/two-factor/disable — turn 2FA off (AC-07). 403 `org_enforced` when the org mandates it. */
export type DisableTwoFactorErrorCode = 'org_enforced';

export interface DisableTwoFactorErrorResponse {
  error: DisableTwoFactorErrorCode;
}

export interface DisableTwoFactorResponse {
  ok: true;
}

// ── Active sessions (AC-08/09) ─────────────────────────────────────────────

export type DeviceType = 'desktop' | 'mobile';

/**
 * One active session on the account (design §19.4 SessionCard). Location is city + country only, never
 * street-level. The `current` session's sign-out is disabled with a reason in the UI, never omitted (AC-08).
 */
export interface DeviceSession {
  id: string;
  deviceType: DeviceType;
  /** e.g. "Chrome", or "Clearline iOS app" for the mobile client. */
  browser: string;
  /** e.g. "macOS", "Windows", "iPhone". */
  os: string;
  city: string;
  /** ISO country code or short name, e.g. "US". */
  country: string;
  /** ISO-8601 last-active timestamp — sorted most-recent-first (AC-08). */
  lastActiveAt: string;
  /** The session making this request — its sign-out is disabled with a reason (AC-08). */
  current: boolean;
}

/** GET /api/security/sessions — all active sessions, most-recently-active first (AC-08). */
export interface SessionListResponse {
  sessions: DeviceSession[];
}

/** POST /api/security/sessions/revoke-others — sign out every session except the caller's (AC-09). */
export interface RevokeOtherSessionsResponse {
  /** How many other sessions were revoked — feeds the "N other devices" confirmation copy (AC-09). */
  revokedCount: number;
}

/** DELETE /api/security/sessions/:id — idempotent; revoking an already-gone session is not an error (edge case). */
export interface RevokeSessionResponse {
  ok: true;
}

// ── Trusted devices (AC-10) ────────────────────────────────────────────────

/**
 * A device flagged "Remember this device" at a 2FA login, thereby exempt from the 2FA challenge on later
 * logins. Removing it re-arms the challenge for that device's next login (AC-10).
 */
export interface TrustedDevice {
  id: string;
  /** Human label, e.g. "Chrome on macOS · San Francisco". */
  label: string;
  /** ISO-8601 when the device was trusted. */
  trustedAt: string;
  /** ISO-8601 last time this device skipped the 2FA challenge. */
  lastUsedAt: string;
}

/** GET /api/security/trusted-devices — the current trusted-device exemptions (AC-10). */
export interface TrustedDeviceListResponse {
  devices: TrustedDevice[];
}

/** DELETE /api/security/trusted-devices/:id — remove the exemption so the next login re-prompts for 2FA (AC-10). */
export interface RemoveTrustedDeviceResponse {
  ok: true;
}
