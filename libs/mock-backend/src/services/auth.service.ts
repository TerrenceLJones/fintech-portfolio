import {
  isLockedOut,
  isResetTokenExpired,
  isValidSignUpPassword,
  isVerificationTokenExpired,
  isAccessTokenExpired,
  classifyRefreshTokenPresentation,
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
  /** Present only on outcome 'success' — true if this account already had another active session at login time (US-CW-002 AC-07). */
  hasOtherActiveSession?: boolean;
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

/** Why a refresh-token family was killed before its natural expiry — surfaced to the client so it can show the right copy (US-CW-002 AC-02 vs AC-06). */
export type RevocationReason = 'reuse_detected' | 'password_changed';

export type RefreshOutcome = 'success' | 'reused' | 'revoked' | 'expired' | 'invalid';

export interface RefreshResult {
  outcome: RefreshOutcome;
  accessToken?: string;
  refreshToken?: string;
  /** Present only when outcome is 'revoked'. */
  reason?: RevocationReason;
}

export type SessionCheckOutcome = 'active' | 'expired' | 'revoked' | 'invalid';

export interface SessionCheckResult {
  outcome: SessionCheckOutcome;
  /** Present only when outcome is 'active'. */
  userId?: string;
  /** Present only when outcome is 'active'. */
  email?: string;
  /** Present only when outcome is 'revoked'. */
  reason?: RevocationReason;
}

/**
 * One family per login (not per email) — a second device logging in must not kill the first's
 * session (US-CW-002 AC-07), so each successful login/verifyEmail mints its own family rather
 * than reusing or replacing whatever family already exists for the email. `issuedAt` is the
 * family's origin (the original login), and stays fixed across rotation — it anchors the
 * refresh-token TTL so rotating indefinitely can't extend a session forever.
 */
interface RefreshTokenFamily {
  id: string;
  email: string;
  issuedAt: number;
  /** Hash of the one refresh token currently valid for this family. */
  currentTokenHash: string;
  /** Hashes of every token this family has already rotated past — presenting one again is reuse. */
  usedTokenHashes: Set<string>;
  revoked: boolean;
  revokedReason?: RevocationReason;
}

interface SerializedRefreshTokenFamily {
  id: string;
  email: string;
  issuedAt: number;
  currentTokenHash: string;
  usedTokenHashes: string[];
  revoked: boolean;
  revokedReason?: RevocationReason;
}

interface AccessTokenRecord {
  familyId: string;
  issuedAt: number;
}

/** Plain-object mirror of AuthService's internal Maps/Sets, safe to JSON.stringify. */
export interface AuthServiceSnapshot {
  users: [string, SeedUser][];
  failedAttempts: [string, FailedAttempt[]][];
  auditLog: AuditEvent[];
  resetTokens: [string, ResetTokenRecord][];
  verificationTokens: [string, VerificationTokenRecord][];
  refreshTokenFamilies: SerializedRefreshTokenFamily[];
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
    | 'login_blocked_unverified'
    | 'refresh_token_reuse_detected';
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
  private readonly familiesById = new Map<string, RefreshTokenFamily>();
  /** Maps a refresh token's hash — current or already-used — back to its family, so a replayed stale token can still be traced to the family it must revoke. */
  private readonly familyIdByTokenHash = new Map<string, string>();
  /** Access tokens are short-lived and never persisted beyond this process, so unlike refresh tokens they're kept raw rather than hashed. */
  private readonly accessTokensByToken = new Map<string, AccessTokenRecord>();
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

    // Computed before minting this login's own family, which is never "other" than itself.
    const hasOtherActiveSession = this.hasActiveFamily(key);
    const { accessToken, refreshToken } = await this.createFamily(key, now);

    return { outcome: 'success', accessToken, refreshToken, hasOtherActiveSession };
  }

  /** True if `token` is the current (not yet rotated), unrevoked refresh token for `email`. */
  async isRefreshTokenActive(email: string, token: string): Promise<boolean> {
    const family = await this.findFamilyByToken(token);
    return !!family && family.email === email.toLowerCase() && !family.revoked;
  }

  /**
   * Exchanges a refresh token for a fresh access/refresh pair, rotating the family forward.
   * Reuse of an already-rotated token revokes the entire family and audits a security incident
   * (AC-02); a family already revoked for any reason reports that reason rather than re-detecting
   * reuse (AC-06 shares this path — a password change elsewhere revokes the family the same way);
   * a family past its refresh-token TTL reports 'expired' without being revoked, since natural
   * expiry isn't a compromise (AC-03).
   */
  async refresh(token: string, now: number = Date.now(), ip?: string): Promise<RefreshResult> {
    const tokenHash = await hashToken(token);
    const familyId = this.familyIdByTokenHash.get(tokenHash);
    if (!familyId) {
      return { outcome: 'invalid' };
    }
    const family = this.familiesById.get(familyId)!;

    const classification = classifyRefreshTokenPresentation(
      {
        isUsed: family.usedTokenHashes.has(tokenHash),
        isRevoked: family.revoked,
        issuedAt: family.issuedAt,
      },
      now,
    );

    if (classification === 'revoked') {
      return { outcome: 'revoked', reason: family.revokedReason };
    }

    if (classification === 'reused') {
      // The presented token was already rotated past — its holder can no longer be trusted to be
      // the legitimate session, so the whole family dies rather than just this one token.
      family.revoked = true;
      family.revokedReason = 'reuse_detected';
      this.auditLog.push({
        type: 'refresh_token_reuse_detected',
        email: family.email,
        ip,
        timestamp: now,
      });
      return { outcome: 'reused' };
    }

    if (classification === 'expired') {
      return { outcome: 'expired' };
    }

    family.usedTokenHashes.add(tokenHash);
    const refreshToken = `refresh_${crypto.randomUUID()}`;
    const newTokenHash = await hashToken(refreshToken);
    family.currentTokenHash = newTokenHash;
    this.familyIdByTokenHash.set(newTokenHash, familyId);

    const accessToken = `access_${crypto.randomUUID()}`;
    this.accessTokensByToken.set(accessToken, { familyId, issuedAt: now });

    return { outcome: 'success', accessToken, refreshToken };
  }

  /**
   * Validates an access token against its family's live state — this is what makes AC-06 work:
   * Device A's access token can still be unexpired, but if Device B's password change revoked its
   * family in the meantime, the very next call here reports 'revoked' rather than 'active'.
   */
  checkSession(accessToken: string, now: number = Date.now()): SessionCheckResult {
    const record = this.accessTokensByToken.get(accessToken);
    if (!record) {
      return { outcome: 'invalid' };
    }

    const family = this.familiesById.get(record.familyId)!;
    if (family.revoked) {
      return { outcome: 'revoked', reason: family.revokedReason };
    }
    if (isAccessTokenExpired(record.issuedAt, now)) {
      return { outcome: 'expired' };
    }

    const user = this.usersByEmail.get(family.email);
    return { outcome: 'active', userId: user!.id, email: family.email };
  }

  /** Revokes the family the presented refresh token belongs to. A no-op (not an error) for a token that doesn't map to any family, matching a real logout endpoint's idempotent 200. */
  async logout(refreshToken: string): Promise<void> {
    const family = await this.findFamilyByToken(refreshToken);
    if (family) family.revoked = true;
  }

  /**
   * Test-only: backdates every access token issued under `email`'s active families so the next
   * checkSession() call reports it expired. Production code never back-dates an already-issued
   * token — this exists purely so an e2e test can exercise US-CW-002 AC-01's 401-then-refresh
   * flow without waiting out the real TTL, the same reason issueExpiredResetTokenForE2E exists.
   */
  expireAccessTokensForE2E(email: string): void {
    const key = email.toLowerCase();
    const activeFamilyIds = new Set(
      [...this.familiesById.values()]
        .filter((family) => family.email === key && !family.revoked)
        .map((family) => family.id),
    );
    for (const [token, record] of this.accessTokensByToken) {
      if (activeFamilyIds.has(record.familyId)) {
        this.accessTokensByToken.set(token, { ...record, issuedAt: 0 });
      }
    }
  }

  /**
   * Test-only: backdates `email`'s active refresh-token families past their TTL, and their access
   * tokens too (a session this stale would naturally have an expired access token as well) — for
   * US-CW-002 AC-03 e2e coverage. See expireAccessTokensForE2E for the same rationale.
   */
  expireRefreshTokenFamiliesForE2E(email: string): void {
    const key = email.toLowerCase();
    for (const family of this.familiesById.values()) {
      if (family.email === key && !family.revoked) family.issuedAt = 0;
    }
    this.expireAccessTokensForE2E(email);
  }

  /**
   * Test-only: mints a fresh, properly-registered access token against `email`'s most recently
   * created active family, without requiring a real refresh() call. Exists for browser-based e2e
   * coverage of US-CW-002 AC-01's "refresh succeeds" outcome, where the real refresh-token cookie
   * can't round-trip through a Service Worker (see browser.ts's simulateRefreshOutcomeForE2E) — so
   * the e2e-only override standing in for a successful refresh needs some other way to hand back a
   * token checkSession() will actually recognize.
   */
  mintAccessTokenForE2E(email: string, now: number = Date.now()): string {
    const key = email.toLowerCase();
    let latestFamily: RefreshTokenFamily | undefined;
    for (const family of this.familiesById.values()) {
      if (family.email === key && !family.revoked) {
        if (!latestFamily || family.issuedAt >= latestFamily.issuedAt) latestFamily = family;
      }
    }
    if (!latestFamily) {
      throw new Error(`mintAccessTokenForE2E: no active family for ${email}`);
    }

    const accessToken = `access_${crypto.randomUUID()}`;
    this.accessTokensByToken.set(accessToken, { familyId: latestFamily.id, issuedAt: now });
    return accessToken;
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
    // revoke every refresh-token family issued for this account (US-CW-002 AC-06), not just
    // whichever one (if any) made this request. Each device's session dies on its own next
    // authenticated request via checkSession/refresh, not right now in real time.
    for (const family of this.familiesById.values()) {
      if (family.email === record.email && !family.revoked) {
        family.revoked = true;
        family.revokedReason = 'password_changed';
      }
    }
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

    const { accessToken, refreshToken } = await this.createFamily(record.email, now);

    return { outcome: 'success', accessToken, refreshToken };
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

  /**
   * Plain-object copy of all internal state, safe to JSON.stringify — see PersistedAuthService.
   * Deliberately excludes accessTokensByToken: PersistedAuthService's whole purpose is surviving
   * a page reload, but a reload already clears the client's in-memory access token by design (see
   * access-token-store.ts) — RequireAuth always re-establishes a fresh one via silent refresh on
   * the next mount regardless, so a stale server-side record would serve no purpose. It would only
   * cost something: persisting it here would put the raw access-token string in sessionStorage,
   * which is exactly what US-CW-001 AC-01's "in memory only" contract exists to prevent client-side
   * — this keeps that guarantee true from the mock server's side too, not just the browser's.
   */
  snapshot(): AuthServiceSnapshot {
    return {
      users: [...this.usersByEmail],
      failedAttempts: [...this.failedAttemptsByEmail],
      auditLog: [...this.auditLog],
      resetTokens: [...this.resetTokensByTokenHash],
      verificationTokens: [...this.verificationTokensByTokenHash],
      refreshTokenFamilies: [...this.familiesById.values()].map((family) => ({
        ...family,
        usedTokenHashes: [...family.usedTokenHashes],
      })),
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

    this.familiesById.clear();
    this.familyIdByTokenHash.clear();
    snapshot.refreshTokenFamilies.forEach((serialized) => {
      const family: RefreshTokenFamily = {
        ...serialized,
        usedTokenHashes: new Set(serialized.usedTokenHashes),
      };
      this.familiesById.set(family.id, family);
      this.familyIdByTokenHash.set(family.currentTokenHash, family.id);
      family.usedTokenHashes.forEach((hash) => this.familyIdByTokenHash.set(hash, family.id));
    });

    // Deliberately not restored — see the doc comment on snapshot(). Every access token is void
    // after a restore; the client always re-establishes a fresh one via silent refresh regardless.
    this.accessTokensByToken.clear();

    this.notificationsSent.length = 0;
    this.notificationsSent.push(...snapshot.notifications);
  }

  private hasActiveFamily(email: string): boolean {
    for (const family of this.familiesById.values()) {
      if (family.email === email && !family.revoked) return true;
    }
    return false;
  }

  private async createFamily(
    email: string,
    now: number,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshToken = `refresh_${crypto.randomUUID()}`;
    const tokenHash = await hashToken(refreshToken);
    const familyId = `family_${crypto.randomUUID()}`;
    this.familiesById.set(familyId, {
      id: familyId,
      email,
      issuedAt: now,
      currentTokenHash: tokenHash,
      usedTokenHashes: new Set(),
      revoked: false,
    });
    this.familyIdByTokenHash.set(tokenHash, familyId);

    const accessToken = `access_${crypto.randomUUID()}`;
    this.accessTokensByToken.set(accessToken, { familyId, issuedAt: now });

    return { accessToken, refreshToken };
  }

  /** Looks up the family a raw refresh token (current or already-used) belongs to. */
  private async findFamilyByToken(token: string): Promise<RefreshTokenFamily | undefined> {
    const familyId = this.familyIdByTokenHash.get(await hashToken(token));
    return familyId ? this.familiesById.get(familyId) : undefined;
  }

  private lockOut(email: string, ip: string, now: number): LoginResult {
    const supportReferenceId = `SR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    this.auditLog.push({ type: 'account_locked', email, supportReferenceId, ip, timestamp: now });
    return { outcome: 'account_locked', supportReferenceId };
  }
}
