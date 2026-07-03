import { isLockedOut, verifyPassword, type FailedAttempt } from '@fintech-portfolio/domain-auth';
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

export interface AuditEvent {
  type: 'login_success' | 'login_failure' | 'account_locked';
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
  ip: string;
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

  constructor(users: SeedUser[] = SEED_USERS) {
    this.usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  }

  async login(email: string, password: string, ip: string, now: number = Date.now()): Promise<LoginResult> {
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
    const passwordMatches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH_FOR_TIMING_PARITY);
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
    return {
      outcome: 'success',
      accessToken: `access_${crypto.randomUUID()}`,
      refreshToken: `refresh_${crypto.randomUUID()}`,
    };
  }

  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog;
  }

  private lockOut(email: string, ip: string, now: number): LoginResult {
    const supportReferenceId = `SR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    this.auditLog.push({ type: 'account_locked', email, supportReferenceId, ip, timestamp: now });
    return { outcome: 'account_locked', supportReferenceId };
  }
}
