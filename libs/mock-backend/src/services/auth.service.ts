import {
  isLockedOut,
  isResetTokenExpired,
  isValidSignUpPassword,
  isVerificationTokenExpired,
  verifyPassword,
  isValidPassword,
  hashPassword,
  hashToken,
  type FailedAttempt,
} from '@fintech-portfolio/domain-auth';
import { SEED_USERS, type SeedUser } from '../fixtures/users.fixture';

/** No real user's hash — exists only so an unregistered-email login takes the same PBKDF2 time as a real one. */
const DUMMY_HASH_FOR_TIMING_PARITY =
  'pbkdf2-sha256$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

export type LoginOutcome =
  'success' | 'invalid_credentials' | 'account_locked' | 'unverified_account';

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

interface VerificationTokenRecord {
  email: string;
  issuedAt: number;
  used: boolean;
}

export type SignUpOutcome = 'success' | 'weak_password';

export interface SignUpResult {
  outcome: SignUpOutcome;
  /**
   * Present only when a new verification email was actually sent — i.e. not for an
   * already-registered, already-verified email (AC-02). Never surfaced over the network, same
   * rule as RequestPasswordResetResult.token — see the handler.
   */
  verificationToken?: string;
}

export type VerifyEmailOutcome = 'success' | 'token_invalid' | 'token_expired';

export interface VerifyEmailResult {
  outcome: VerifyEmailOutcome;
  accessToken?: string;
  refreshToken?: string;
}

/** Plain-object mirror of AuthService's internal Maps/Sets, safe to JSON.stringify. */
export interface AuthServiceSnapshot {
  users: [string, SeedUser][];
  failedAttempts: [string, FailedAttempt[]][];
  auditLog: AuditEvent[];
  resetTokens: [string, ResetTokenRecord][];
  verificationTokens: [string, VerificationTokenRecord][];
  activeRefreshTokens: [string, string[]][];
  notifications: NotificationEvent[];
}

export interface NotificationEvent {
  type: 'password_changed' | 'signup_verification' | 'signup_existing_account';
  email: string;
  timestamp: number;
}

export interface AuditEvent {
  type:
    | 'login_success'
    | 'login_failure'
    | 'account_locked'
    | 'password_reset'
    | 'email_verified'
    | 'login_blocked_unverified';
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
  /** Keyed by the SHA-256 hash of the token, never the raw token — see hashToken. */
  private readonly resetTokensByTokenHash = new Map<string, ResetTokenRecord>();
  /** Keyed by the SHA-256 hash of the token, never the raw token — see hashToken. */
  private readonly verificationTokensByTokenHash = new Map<string, VerificationTokenRecord>();
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

    // A successful password match clears any failed-attempt history for this email — otherwise
    // stale failures from before it would still count toward the 5-in-15-minutes threshold,
    // letting a single subsequent mistake lock out a user who just proved they know the password.
    // This applies even when verified is false below: the credentials were correct, so this isn't
    // a failure to penalize via lockout accounting — only the account's verified state blocks it.
    this.failedAttemptsByEmail.delete(key);

    // AC-07: correct credentials for an unverified account must not issue tokens. Only reachable
    // once the password has already matched, so this doesn't reopen AC-02/AC-03's enumeration
    // guarantee — an attacker without the correct password never reaches this branch.
    if (!user.verified) {
      this.auditLog.push({
        type: 'login_blocked_unverified',
        userId: user.id,
        email,
        ip,
        timestamp: now,
      });
      return { outcome: 'unverified_account' };
    }

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
   * hash is persisted (see hashToken); the raw token returned here is the one — and only —
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
    const tokenHash = await hashToken(token);
    this.resetTokensByTokenHash.set(tokenHash, { email: key, issuedAt: now, used: false });
    return { token };
  }

  async isResetTokenValid(token: string, now: number = Date.now()): Promise<boolean> {
    const record = this.resetTokensByTokenHash.get(await hashToken(token));
    return !!record && !record.used && !isResetTokenExpired(record.issuedAt, now);
  }

  async resetPassword(
    token: string,
    newPassword: string,
    now: number = Date.now(),
  ): Promise<ResetPasswordResult> {
    const tokenHash = await hashToken(token);
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

  /**
   * Three outcomes, all returning the same `{outcome: 'success'}` shape from the caller's
   * perspective (only `verificationToken`'s presence differs, and the handler must never branch
   * on it — same enumeration-safety rule as requestPasswordReset):
   *  - unregistered email: create the account unverified (AC-01) and mint a verification token.
   *  - already registered AND verified: the real enumeration case AC-02 protects against — no
   *    account created, no token minted, just an "already have an account" notice.
   *  - already registered but NOT verified (an incomplete prior sign-up, including a same-page
   *    "Resend"): treat as a resend — update the password to what was just submitted and mint a
   *    fresh token, same as requestPasswordReset's precedent of never invalidating prior unused
   *    tokens when a new one is issued.
   */
  async signUp(email: string, password: string, now: number = Date.now()): Promise<SignUpResult> {
    if (!isValidSignUpPassword(password)) {
      return { outcome: 'weak_password' };
    }

    const key = email.toLowerCase();
    const existingUser = this.usersByEmail.get(key);

    // Hashed unconditionally, even on the branch below that discards it, so an already-registered
    // (verified) email and a brand-new one both pay the same PBKDF2 cost — otherwise the handler
    // awaiting this call end-to-end would let response latency alone distinguish the two branches,
    // the same timing side-channel login's DUMMY_HASH_FOR_TIMING_PARITY exists to close.
    const passwordHash = await hashPassword(password);

    if (existingUser?.verified) {
      this.notificationsSent.push({ type: 'signup_existing_account', email: key, timestamp: now });
      return { outcome: 'success' };
    }

    if (existingUser) {
      existingUser.passwordHash = passwordHash;
    } else {
      this.usersByEmail.set(key, {
        id: `user_${crypto.randomUUID()}`,
        email: key,
        passwordHash,
        verified: false,
      });
    }

    const token = `verify_${crypto.randomUUID()}`;
    const tokenHash = await hashToken(token);
    this.verificationTokensByTokenHash.set(tokenHash, { email: key, issuedAt: now, used: false });
    this.notificationsSent.push({ type: 'signup_verification', email: key, timestamp: now });

    return { outcome: 'success', verificationToken: token };
  }

  /**
   * Consumes a verification token and, on success, auto-logs the now-verified user in exactly
   * like a fresh login() would (AC-03) — there's no separate "log in after verifying" step for
   * the user to go through.
   */
  async verifyEmail(token: string, now: number = Date.now()): Promise<VerifyEmailResult> {
    const tokenHash = await hashToken(token);
    const record = this.verificationTokensByTokenHash.get(tokenHash);
    if (!record || record.used) {
      return { outcome: 'token_invalid' };
    }

    if (isVerificationTokenExpired(record.issuedAt, now)) {
      return { outcome: 'token_expired' };
    }

    const user = this.usersByEmail.get(record.email);
    // The token can only have been issued for a user that existed at issuance time.
    user!.verified = true;
    record.used = true;
    this.auditLog.push({
      type: 'email_verified',
      email: record.email,
      userId: user!.id,
      timestamp: now,
    });

    const refreshToken = `refresh_${crypto.randomUUID()}`;
    const activeTokens = this.activeRefreshTokensByEmail.get(record.email) ?? new Set<string>();
    activeTokens.add(refreshToken);
    this.activeRefreshTokensByEmail.set(record.email, activeTokens);

    return {
      outcome: 'success',
      accessToken: `access_${crypto.randomUUID()}`,
      refreshToken,
    };
  }

  async isVerificationTokenValid(token: string, now: number = Date.now()): Promise<boolean> {
    const record = this.verificationTokensByTokenHash.get(await hashToken(token));
    return !!record && !record.used && !isVerificationTokenExpired(record.issuedAt, now);
  }

  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog;
  }

  getSentNotifications(): readonly NotificationEvent[] {
    return this.notificationsSent;
  }

  /** Plain-object copy of all internal state, safe to JSON.stringify — see PersistedAuthService. */
  snapshot(): AuthServiceSnapshot {
    return {
      users: [...this.usersByEmail],
      failedAttempts: [...this.failedAttemptsByEmail],
      auditLog: [...this.auditLog],
      resetTokens: [...this.resetTokensByTokenHash],
      verificationTokens: [...this.verificationTokensByTokenHash],
      activeRefreshTokens: [...this.activeRefreshTokensByEmail].map(([email, tokens]) => [
        email,
        [...tokens],
      ]),
      notifications: [...this.notificationsSent],
    };
  }

  /** Replaces all internal state with `snapshot` — see PersistedAuthService. */
  restore(snapshot: AuthServiceSnapshot): void {
    this.usersByEmail.clear();
    snapshot.users.forEach(([email, user]) => this.usersByEmail.set(email, user));

    this.failedAttemptsByEmail.clear();
    snapshot.failedAttempts.forEach(([email, attempts]) =>
      this.failedAttemptsByEmail.set(email, attempts),
    );

    this.auditLog.length = 0;
    this.auditLog.push(...snapshot.auditLog);

    this.resetTokensByTokenHash.clear();
    snapshot.resetTokens.forEach(([hash, record]) => this.resetTokensByTokenHash.set(hash, record));

    this.verificationTokensByTokenHash.clear();
    snapshot.verificationTokens.forEach(([hash, record]) =>
      this.verificationTokensByTokenHash.set(hash, record),
    );

    this.activeRefreshTokensByEmail.clear();
    snapshot.activeRefreshTokens.forEach(([email, tokens]) =>
      this.activeRefreshTokensByEmail.set(email, new Set(tokens)),
    );

    this.notificationsSent.length = 0;
    this.notificationsSent.push(...snapshot.notifications);
  }

  private lockOut(email: string, ip: string, now: number): LoginResult {
    const supportReferenceId = `SR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    this.auditLog.push({ type: 'account_locked', email, supportReferenceId, ip, timestamp: now });
    return { outcome: 'account_locked', supportReferenceId };
  }
}
