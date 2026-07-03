import {
  isLockedOut,
  isResetTokenExpired,
  verifyPassword,
  isValidPassword,
  hashPassword,
  hashResetToken,
  type FailedAttempt,
} from '@fintech-portfolio/domain-auth';
import { SEED_USERS, type SeedUser } from '../fixtures/users.fixture';

/** No real user's hash — exists only so an unregistered-email login takes the same PBKDF2 time as a real one. */
const DUMMY_HASH_FOR_TIMING_PARITY =
  'pbkdf2-sha256$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

export type LoginOutcome = 'success' | 'invalid_credentials' | 'account_locked';

export interface LoginResult {
  outcome: LoginOutcome;
  accessToken?: string;
  refreshToken?: string;
  supportReferenceId?: string;
}

export type ResetPasswordOutcome = 'success' | 'token_invalid' | 'token_expired' | 'weak_password';

export interface RequestPasswordResetResult {
  /** Present only when the email is registered — never surfaced over the network, see the handler. */
  token?: string;
}

export interface ResetPasswordResult {
  outcome: ResetPasswordOutcome;
}

interface ResetTokenRecord {
  email: string;
  issuedAt: number;
  used: boolean;
}

export interface NotificationEvent {
  type: 'password_changed';
  email: string;
  timestamp: number;
}

export interface AuditEvent {
  type: 'login_success' | 'login_failure' | 'account_locked' | 'password_reset';
  /**
   * The attempted email, present on every event regardless of outcome — this is the only
   * identifier available for an account_locked/login_failure event against an unregistered
   * email (there is no `userId` to fall back to), and support recovery is keyed off it via
   * the support reference ID. Logging it here is safe: this audit log is server-side only,
   * never returned to the client, so it doesn't reopen the enumeration side-channel AC-02/
   * AC-03 close off in the response itself.
   */
  email: string;
  /** Present only when `type` is 'login_success' — a registered user was matched. */
  userId?: string;
  /** Present only when `type` is 'account_locked' — lets support find this event from the ID shown to the user. */
  supportReferenceId?: string;
  /** Absent for password_reset — that flow happens via an emailed link, not a live request. */
  ip?: string;
  timestamp: number;
}

/**
 * Failed-attempt tracking is keyed by the attempted email regardless of whether that email is
 * registered. Only tracking attempts against real accounts would let an attacker distinguish
 * "unregistered" (never locks) from "registered" (locks after 5) — an enumeration side-channel
 * distinct from, and in addition to, the identical invalid_credentials error message.
 */
export class AuthService {
  private readonly usersByEmail: Map<string, SeedUser>;
  private readonly failedAttemptsByEmail = new Map<string, FailedAttempt[]>();
  private readonly auditLog: AuditEvent[] = [];
  /** Keyed by the SHA-256 hash of the token, never the raw token — see hashResetToken. */
  private readonly resetTokensByTokenHash = new Map<string, ResetTokenRecord>();
  /** Every refresh token issued by a successful login, keyed by email, until revoked. */
  private readonly activeRefreshTokensByEmail = new Map<string, Set<string>>();
  private readonly notificationsSent: NotificationEvent[] = [];

  constructor(users: SeedUser[] = SEED_USERS) {
    // Copy each user rather than storing the caller's reference — resetPassword mutates the
    // stored record in place, and must not corrupt the caller's (possibly shared) fixture array.
    this.usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), { ...user }]));
  }

  async login(
    email: string,
    password: string,
    ip: string,
    now: number = Date.now(),
  ): Promise<LoginResult> {
    const key = email.toLowerCase();
    const priorAttempts = this.failedAttemptsByEmail.get(key) ?? [];

    if (isLockedOut(priorAttempts, now)) {
      return this.lockOut(email, ip, now);
    }

    const user = this.usersByEmail.get(key);
    // Always run verifyPassword, even for an unregistered email, against a fixed dummy hash —
    // otherwise the missing-user branch returns near-instantly while the wrong-password branch
    // takes PBKDF2's ~tens-of-ms, a timing side-channel that would let an attacker enumerate
    // registered emails by measuring response latency alone.
    const passwordMatches = await verifyPassword(
      password,
      user?.passwordHash ?? DUMMY_HASH_FOR_TIMING_PARITY,
    );
    if (!user || !passwordMatches) {
      const attempts = [...priorAttempts, { timestamp: now }];
      this.failedAttemptsByEmail.set(key, attempts);
      this.auditLog.push({ type: 'login_failure', email, ip, timestamp: now });

      if (isLockedOut(attempts, now)) {
        return this.lockOut(email, ip, now);
      }
      return { outcome: 'invalid_credentials' };
    }

    // A successful login clears any failed-attempt history for this email — otherwise stale
    // failures from before the success would still count toward the 5-in-15-minutes threshold,
    // letting a single subsequent mistake lock out a user who just proved they know the password.
    this.failedAttemptsByEmail.delete(key);
    this.auditLog.push({ type: 'login_success', userId: user.id, email, ip, timestamp: now });

    const refreshToken = `refresh_${crypto.randomUUID()}`;
    const activeTokens = this.activeRefreshTokensByEmail.get(key) ?? new Set<string>();
    activeTokens.add(refreshToken);
    this.activeRefreshTokensByEmail.set(key, activeTokens);

    return {
      outcome: 'success',
      accessToken: `access_${crypto.randomUUID()}`,
      refreshToken,
    };
  }

  /** True if `token` was issued by a successful login for `email` and hasn't since been revoked. */
  isRefreshTokenActive(email: string, token: string): boolean {
    return this.activeRefreshTokensByEmail.get(email.toLowerCase())?.has(token) ?? false;
  }

  /**
   * Issues a single-use reset token only when the email is registered, but always returns the
   * same result shape either way — callers (the HTTP handler) must not branch on `token`'s
   * presence in a way that leaks into the response, or this defeats the point. Only the token's
   * hash is persisted (see hashResetToken); the raw token returned here is the one — and only —
   * copy, standing in for the link a real backend would email out.
   */
  async requestPasswordReset(
    email: string,
    now: number = Date.now(),
  ): Promise<RequestPasswordResetResult> {
    const key = email.toLowerCase();
    const user = this.usersByEmail.get(key);
    if (!user) {
      return {};
    }

    const token = `reset_${crypto.randomUUID()}`;
    const tokenHash = await hashResetToken(token);
    this.resetTokensByTokenHash.set(tokenHash, { email: key, issuedAt: now, used: false });
    return { token };
  }

  async isResetTokenValid(token: string, now: number = Date.now()): Promise<boolean> {
    const record = this.resetTokensByTokenHash.get(await hashResetToken(token));
    return !!record && !record.used && !isResetTokenExpired(record.issuedAt, now);
  }

  async resetPassword(
    token: string,
    newPassword: string,
    now: number = Date.now(),
  ): Promise<ResetPasswordResult> {
    const tokenHash = await hashResetToken(token);
    const record = this.resetTokensByTokenHash.get(tokenHash);
    if (!record || record.used) {
      return { outcome: 'token_invalid' };
    }

    if (isResetTokenExpired(record.issuedAt, now)) {
      return { outcome: 'token_expired' };
    }

    if (!isValidPassword(newPassword)) {
      return { outcome: 'weak_password' };
    }

    const user = this.usersByEmail.get(record.email);
    // The token can only have been issued for a user that existed at issuance time.
    user!.passwordHash = await hashPassword(newPassword);
    record.used = true;
    this.auditLog.push({
      type: 'password_reset',
      email: record.email,
      userId: user!.id,
      timestamp: now,
    });

    // A changed password must invalidate every session it could otherwise still be reused in —
    // revoke every refresh token issued for this account, not just the one (if any) tied to
    // whatever session made this request.
    this.activeRefreshTokensByEmail.delete(record.email);
    this.notificationsSent.push({ type: 'password_changed', email: record.email, timestamp: now });

    return { outcome: 'success' };
  }

  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog;
  }

  getSentNotifications(): readonly NotificationEvent[] {
    return this.notificationsSent;
  }

  private lockOut(email: string, ip: string, now: number): LoginResult {
    const supportReferenceId = `SR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    this.auditLog.push({ type: 'account_locked', email, supportReferenceId, ip, timestamp: now });
    return { outcome: 'account_locked', supportReferenceId };
  }
}
