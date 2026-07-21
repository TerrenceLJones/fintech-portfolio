import {
  isLockedOut,
  isResetTokenExpired,
  isValidSignUpPassword,
  isVerificationTokenExpired,
  isInviteTokenExpired,
  isAccessTokenExpired,
  classifyRefreshTokenPresentation,
  ownerProvisioning,
  defaultApprovalLimitForRole,
  verifyPassword,
  isValidPassword,
  hashPassword,
  hashToken,
  buildOtpauthUri,
  generateBackupCodes,
  generateTotpSecret,
  verifyTotpCode,
  type FailedAttempt,
} from '@clearline/domain-auth';
import {
  EMAIL_CHANGE_TTL_MS,
  applyNotificationSummary as applyNotificationSummaryPolicy,
  defaultNotificationPrefs,
  isSameEmail,
  isValidEmail,
} from '@clearline/domain-profile';
import type {
  ApprovalPolicyTier,
  ApprovalPolicyTierInput,
  CompanyProfileResponse,
  DeviceSession,
  NotificationFrequency,
  NotificationPreference,
  NotificationTypeKey,
  Organization,
  OutOfPolicyBehavior,
  PendingInvite,
  ProfileResponse,
  Role,
  TeamMember,
  TeamRosterResponse,
  TrustedDevice,
  TwoFactorStatus,
} from '@clearline/contracts';
import { DEFAULT_APPROVAL_TIERS } from '@clearline/domain-expenses';
import { SEED_ORGANIZATION, SEED_USERS, type SeedUser } from '../fixtures/users.fixture';
import {
  defaultCurrentSession,
  defaultTwoFactor,
  seedDeviceSessionsByEmail,
  seedTrustedDevicesByEmail,
  seedTwoFactorByEmail,
  type StoredDeviceSession,
  type StoredTrustedDevice,
  type StoredTwoFactor,
} from '../fixtures/security.fixture';

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

/**
 * An outstanding personal email-change confirmation (US-CW-034 AC-03/04). Keyed by the SHA-256 hash
 * of the single-use token (never the raw token), like reset/verification. `userId` — not the email —
 * anchors it, so a subsequent swap of the same account's email can't strand a token; `newEmail` is
 * the address that becomes the login on confirmation.
 */
interface EmailChangeTokenRecord {
  userId: string;
  newEmail: string;
  issuedAt: number;
  used: boolean;
}

export type RequestEmailChangeOutcome =
  'success' | 'invalid_email' | 'same_as_current' | 'email_taken';

export interface RequestEmailChangeServiceResult {
  outcome: RequestEmailChangeOutcome;
  /** Present only on success — the raw single-use token (stands in for the emailed link). Never surfaced over the network. */
  token?: string;
  /** Present only on success — the address now shown as "Pending". */
  pendingEmail?: string;
}

export type ConfirmEmailChangeServiceOutcome = 'success' | 'token_invalid' | 'token_expired';

export interface ConfirmEmailChangeServiceResult {
  outcome: ConfirmEmailChangeServiceOutcome;
  /** Present only on success — the now-active login email. */
  email?: string;
}

/** An Organization record, keyed to the business it was provisioned for (US-CW-030). */
interface OrganizationRecord {
  id: string;
  legalName: string;
  ein: string;
  /** Epoch ms the organization was provisioned (KYB approval). */
  createdAt: number;
  /** Whether the org mandates 2FA for members (US-CW-035 AC-07); stub until US-CW-040 owns it. */
  enforceTwoFactor?: boolean;
  // --- Company Profile (US-CW-036). All optional so orgs provisioned by
  // provisionOrganizationForOwner (which sets only the identity fields) and pre-US-CW-036 snapshots
  // stay valid; getCompanyProfile coalesces the gaps to sensible defaults. ---
  /** False only for an org that hasn't cleared KYB; absent/true = verified (the seeded/approved case, AC-02). */
  verified?: boolean;
  /** KYB-registered business structure, e.g. "C-Corporation" — read-only on Company Profile. */
  structure?: string;
  /** Primary contact email — editable (AC-01). */
  primaryContactEmail?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  /** Fiscal-year start month 1–12; a change applies next budget period, not retroactively (AC-01). */
  fiscalYearStartMonth?: number;
  // --- Approval Policies & Spend Controls (US-CW-037). Both optional and coalesced to defaults by the
  // getters, so orgs provisioned before this story (and older snapshots) stay valid; editing persists a
  // concrete value. This is the single policy model the expense routing/enforcement consumes (AC-10). ---
  /** The approval-limit tier ladder; absent = the default ladder (DEFAULT_APPROVAL_TIERS). */
  approvalTiers?: ApprovalPolicyTier[];
  /** Spend controls; absent = the default controls (getSpendControls coalesces). */
  spendControls?: StoredSpendControls;
}

/**
 * The org's stored spend controls (US-CW-037). Category caps are a category-agnostic id→limit map
 * (`null` = unlimited); the HTTP handler joins it with the expense category list for labels, so this
 * store never needs to know the category catalogue.
 */
export interface StoredSpendControls {
  receiptRequiredThresholdMinorUnits: number;
  memoRequiredThresholdMinorUnits: number;
  outOfPolicyBehavior: OutOfPolicyBehavior;
  categoryCaps: Record<string, number | null>;
}

/**
 * An outstanding team invite (US-CW-031). Stored keyed by the SHA-256 hash of its single-use token
 * (never the raw token), carrying which org/role/admin it grants and who sent it. `id` is a stable,
 * non-secret handle for the roster's pending row (safe to expose; the token hash is not).
 */
interface InviteTokenRecord {
  id: string;
  orgId: string;
  /** Invitee email, lower-cased. */
  email: string;
  role: Role;
  grantAdmin: boolean;
  /** Display name of the Owner/Admin who sent it, for the acceptance screen. */
  inviterName: string;
  issuedAt: number;
  used: boolean;
}

export type CreateInviteOutcome = 'sent' | 'already_member';

export interface CreateInviteResult {
  outcome: CreateInviteOutcome;
  /** The raw single-use token — present only when a new invite was actually minted. Never surfaced over the network. */
  token?: string;
}

export interface InviteDetails {
  status: 'valid' | 'expired' | 'invalid';
  inviterName?: string;
  organizationName?: string;
  role?: Role;
  email?: string;
}

export type AcceptInviteOutcome = 'success' | 'invite_expired' | 'invite_invalid' | 'weak_password';

export interface AcceptInviteResult {
  outcome: AcceptInviteOutcome;
  accessToken?: string;
  refreshToken?: string;
}

export type TeamMutationOutcome =
  'ok' | 'owner_protected' | 'admin_revoke_forbidden' | 'member_not_found';

export interface ChangeMemberRoleResult {
  outcome: TeamMutationOutcome;
  member?: TeamMember;
  /** The member's role before the change — for the audit diff (US-CW-031 AC-04). */
  previousRole?: Role;
  /** The member's Admin flag before the change — for the admin-change audit event (US-CW-031 AC-08). */
  previousIsAdmin?: boolean;
}

export interface RemoveMemberResult {
  outcome: TeamMutationOutcome;
  /** The removed member as they were just before removal — for the audit record (US-CW-031 AC-04/AC-05). */
  member?: TeamMember;
}

/** Outcome of a pending-invite mutation (resend / revoke): the invite is either found in the org or not. */
export type InviteMutationOutcome = 'ok' | 'invite_not_found';

export interface ResendInviteResult {
  outcome: InviteMutationOutcome;
  /** The freshly minted single-use token — present only on success. Never surfaced over the network. */
  token?: string;
  /** The refreshed pending invite — for the audit record (US-CW-031 AC-09). */
  invite?: PendingInvite;
}

export interface RevokeInviteResult {
  outcome: InviteMutationOutcome;
  /** The invite as it was just before revocation — for the audit record (US-CW-031 AC-10). */
  invite?: PendingInvite;
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
  /** Present only when outcome is 'active'. */
  displayName?: string;
  /** Present only when outcome is 'active' — the user's live role, re-read every check so a mid-session change surfaces on the next request (US-CW-006 AC-05). */
  role?: Role;
  /** Present only when outcome is 'active'. Minor units; null = unlimited. */
  approvalLimit?: number | null;
  /** Present only when outcome is 'active'. */
  isAdmin?: boolean;
  /** Present only when outcome is 'active' — the account creator/Owner flag (US-CW-030). */
  isOwner?: boolean;
  /** Present only when outcome is 'active' — the avatar data URL, or null for the initials fallback (US-CW-034). */
  avatarUrl?: string | null;
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
  emailChangeTokens: [string, EmailChangeTokenRecord][];
  inviteTokens: [string, InviteTokenRecord][];
  organizations: [string, OrganizationRecord][];
  refreshTokenFamilies: SerializedRefreshTokenFamily[];
  notifications: NotificationEvent[];
  // Optional for backward compatibility with a snapshot taken before US-CW-035 existed.
  twoFactor?: [string, StoredTwoFactor][];
  deviceSessions?: [string, StoredDeviceSession[]][];
  trustedDevices?: [string, StoredTrustedDevice[]][];
}

export interface NotificationEvent {
  type:
    | 'password_changed'
    | 'signup_verification'
    | 'signup_existing_account'
    | 'email_change_requested';
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

/** Result of a self-service password change (US-CW-035 AC-01/02). */
export type ChangePasswordResult =
  | { outcome: 'success' }
  | { outcome: 'incorrect_password' }
  | { outcome: 'weak_password' }
  | { outcome: 'unknown_user' };

/** Result of verifying a 6-digit code to complete TOTP setup (US-CW-035 AC-04/05). */
export type VerifyTotpSetupResult =
  | { outcome: 'success'; backupCodes: string[] }
  | { outcome: 'incorrect_code' }
  | { outcome: 'no_pending_setup' }
  | { outcome: 'unknown_user' };

/** Result of disabling 2FA (US-CW-035 AC-07); `org_enforced` when the org mandates it. */
export type DisableTwoFactorResult =
  { outcome: 'success' } | { outcome: 'org_enforced' } | { outcome: 'unknown_user' };

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
  /** Outstanding email-change confirmations, keyed by the SHA-256 hash of the token (US-CW-034). */
  private readonly emailChangeTokensByTokenHash = new Map<string, EmailChangeTokenRecord>();
  private readonly familiesById = new Map<string, RefreshTokenFamily>();
  /** Maps a refresh token's hash — current or already-used — back to its family, so a replayed stale token can still be traced to the family it must revoke. */
  private readonly familyIdByTokenHash = new Map<string, string>();
  /** Access tokens are short-lived and never persisted beyond this process, so unlike refresh tokens they're kept raw rather than hashed. */
  private readonly accessTokensByToken = new Map<string, AccessTokenRecord>();
  private readonly notificationsSent: NotificationEvent[] = [];
  /** Team invites, keyed by the SHA-256 hash of the single-use token — never the raw token (US-CW-031). */
  private readonly invitesByTokenHash = new Map<string, InviteTokenRecord>();
  /** Organization records by id. */
  private readonly orgsById = new Map<string, OrganizationRecord>();
  /** EIN → orgId, so a repeated onboarding of the same EIN reuses its org rather than minting a second (US-CW-030 AC-04). */
  private readonly orgIdByEin = new Map<string, string>();
  /** Per-user 2FA state (US-CW-035). Secret + backup-code hashes never leave the server. */
  private readonly twoFactorByEmail: Map<string, StoredTwoFactor>;
  /** Per-user active device sessions, most-recently-active first when listed (US-CW-035 AC-08). */
  private readonly deviceSessionsByEmail: Map<string, StoredDeviceSession[]>;
  /** Per-user trusted-device exemptions (US-CW-035 AC-10). */
  private readonly trustedDevicesByEmail: Map<string, StoredTrustedDevice[]>;

  constructor(
    users: SeedUser[] = SEED_USERS,
    organizations: readonly OrganizationRecord[] = [SEED_ORGANIZATION],
  ) {
    // Copy each user rather than storing the caller's reference — resetPassword mutates the
    // stored record in place, and must not corrupt the caller's (possibly shared) fixture array.
    this.usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), { ...user }]));
    for (const org of organizations) {
      this.orgsById.set(org.id, { ...org });
      this.orgIdByEin.set(org.ein, org.id);
    }
    // Security state is deep-seeded from its own fixture (see security.fixture.ts for why it's kept
    // off SeedUser). The seed builders return fresh objects, so no fixture aliasing is possible.
    this.twoFactorByEmail = seedTwoFactorByEmail(users);
    this.deviceSessionsByEmail = seedDeviceSessionsByEmail(users);
    this.trustedDevicesByEmail = seedTrustedDevicesByEmail(users);
  }

  private toOrganization(record: OrganizationRecord): Organization {
    return {
      id: record.id,
      legalName: record.legalName,
      ein: record.ein,
      createdAt: new Date(record.createdAt).toISOString(),
    };
  }

  private toTeamMember(user: SeedUser): TeamMember {
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
      isOwner: user.isOwner,
      joinedAt: new Date(user.joinedAt).toISOString(),
    };
  }

  /**
   * Provision an Organization for the account creator whose KYB just cleared, and assign them Owner —
   * one atomic transition (US-CW-030 AC-01): there is never a persisted state where the business is
   * approved but has no Organization or no Owner. Idempotent per EIN: a repeat provisioning of an EIN
   * that already has an org reuses it and creates no second org (AC-04). The owner elevation reads
   * through on the creator's very next session check, since checkSession re-reads the live record.
   * A no-op returning null for an unknown email.
   */
  provisionOrganizationForOwner(
    email: string,
    business: { legalName: string; ein: string },
    now: number = Date.now(),
  ): Organization | null {
    const user = this.usersByEmail.get(email.toLowerCase());
    if (!user) return null;

    let orgId = this.orgIdByEin.get(business.ein);
    let record: OrganizationRecord;
    if (orgId) {
      record = this.orgsById.get(orgId)!;
    } else {
      orgId = `org_${crypto.randomUUID()}`;
      record = { id: orgId, legalName: business.legalName, ein: business.ein, createdAt: now };
      this.orgsById.set(orgId, record);
      this.orgIdByEin.set(business.ein, orgId);
    }

    // Atomic with org creation: membership + Owner authority assigned in the same transition.
    const provisioning = ownerProvisioning();
    user.orgId = orgId;
    user.role = provisioning.role;
    user.approvalLimit = provisioning.approvalLimit;
    user.isOwner = provisioning.isOwner;
    user.joinedAt = now;

    return this.toOrganization(record);
  }

  /** The orgId a user (by id) belongs to, or null if they aren't in any organization. */
  getOrgIdForUser(userId: string): string | null {
    for (const user of this.usersByEmail.values()) {
      if (user.id === userId) return user.orgId;
    }
    return null;
  }

  /** The full team roster for an organization — members plus pending invites (Design §18.1). Null if the org is unknown. */
  getTeamRoster(orgId: string, now: number = Date.now()): TeamRosterResponse | null {
    const org = this.orgsById.get(orgId);
    if (!org) return null;

    const members = [...this.usersByEmail.values()]
      .filter((user) => user.orgId === orgId)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((user) => this.toTeamMember(user));

    const invites: PendingInvite[] = [...this.invitesByTokenHash.values()]
      .filter(
        (invite) =>
          invite.orgId === orgId && !invite.used && !isInviteTokenExpired(invite.issuedAt, now),
      )
      .sort((a, b) => a.issuedAt - b.issuedAt)
      .map((invite) => this.toPendingInvite(invite));

    return {
      organizationId: org.id,
      organizationName: org.legalName,
      members,
      invites,
    };
  }

  /**
   * Create a single-use, 7-day team invite (US-CW-031 AC-01). Enumeration-safe: the caller always
   * gets the same "sent" shape whether or not the email already has an account — a token is minted
   * ONLY for an email that isn't already a member of some organization, and the raw token never
   * leaves the service in the response (mirrors requestPasswordReset/signUp). Dedupe: a second invite
   * to the same email+org while one is still pending returns the existing one rather than minting a
   * duplicate (edge case). `already_member` when the email is already in THIS org — nothing to send.
   */
  async createInvite(
    input: { orgId: string; email: string; role: Role; grantAdmin: boolean; inviterName: string },
    now: number = Date.now(),
  ): Promise<CreateInviteResult> {
    const email = input.email.toLowerCase();
    const existingUser = this.usersByEmail.get(email);

    // Already a member somewhere — never mint (no cross-org attachment, no duplicate account). If it's
    // this very org, say so; otherwise stay enumeration-safe and just report "sent" with no token.
    if (existingUser?.orgId) {
      return existingUser.orgId === input.orgId
        ? { outcome: 'already_member' }
        : { outcome: 'sent' };
    }

    // Dedupe an already-outstanding invite to the same email+org (edge case: no second token).
    for (const invite of this.invitesByTokenHash.values()) {
      if (
        invite.orgId === input.orgId &&
        invite.email === email &&
        !invite.used &&
        !isInviteTokenExpired(invite.issuedAt, now)
      ) {
        return { outcome: 'sent' };
      }
    }

    const token = `invite_${crypto.randomUUID()}`;
    const tokenHash = await hashToken(token);
    this.invitesByTokenHash.set(tokenHash, {
      id: `invite_${crypto.randomUUID()}`,
      orgId: input.orgId,
      email,
      role: input.role,
      grantAdmin: input.grantAdmin,
      inviterName: input.inviterName,
      issuedAt: now,
      used: false,
    });
    return { outcome: 'sent', token };
  }

  /** What the invite-acceptance page shows before a password is set (Design §18.3). */
  async getInviteDetails(token: string, now: number = Date.now()): Promise<InviteDetails> {
    const record = this.invitesByTokenHash.get(await hashToken(token));
    if (!record || record.used) return { status: 'invalid' };
    if (isInviteTokenExpired(record.issuedAt, now)) return { status: 'expired' };

    const org = this.orgsById.get(record.orgId);
    return {
      status: 'valid',
      inviterName: record.inviterName,
      organizationName: org?.legalName,
      role: record.role,
      email: record.email,
    };
  }

  /**
   * Accept an invite (US-CW-031 AC-02). A brand-new invitee sets a password (validated to sign-up
   * complexity) and an account is created directly into the inviting org with the invite's role —
   * skipping business onboarding entirely, which is a per-organization step the Owner already did.
   * An expired or already-consumed token grants no membership (AC-03). On success the invitee is
   * auto-logged-in exactly like email verification, landing on their role dashboard.
   */
  async acceptInvite(
    token: string,
    password: string,
    now: number = Date.now(),
  ): Promise<AcceptInviteResult> {
    const tokenHash = await hashToken(token);
    const record = this.invitesByTokenHash.get(tokenHash);
    if (!record || record.used) return { outcome: 'invite_invalid' };
    if (isInviteTokenExpired(record.issuedAt, now)) return { outcome: 'invite_expired' };

    const existingUser = this.usersByEmail.get(record.email);
    if (!existingUser && !isValidSignUpPassword(password)) {
      return { outcome: 'weak_password' };
    }

    const approvalLimit = defaultApprovalLimitForRole(record.role);
    if (existingUser) {
      // An account already exists (e.g. signed up but never onboarded) — attach it to the org with
      // the invited role rather than creating a duplicate. It keeps its own password.
      existingUser.orgId = record.orgId;
      existingUser.role = record.role;
      existingUser.approvalLimit = approvalLimit;
      existingUser.isAdmin = record.grantAdmin;
      existingUser.verified = true;
      existingUser.joinedAt = now;
    } else {
      this.usersByEmail.set(record.email, {
        id: `user_${crypto.randomUUID()}`,
        email: record.email,
        passwordHash: await hashPassword(password),
        verified: true,
        displayName: record.email.split('@')[0] ?? record.email,
        role: record.role,
        approvalLimit,
        isAdmin: record.grantAdmin,
        isOwner: false,
        orgId: record.orgId,
        joinedAt: now,
      });
    }

    record.used = true;
    const { accessToken, refreshToken } = await this.createFamily(record.email, now);
    return { outcome: 'success', accessToken, refreshToken };
  }

  /**
   * Change an existing member's approval tier (US-CW-031 AC-04). Gated to a member of the actor's own
   * org. The Owner is protected — their tier can't be changed by anyone (US-CW-030 AC-03). The change
   * reads through on the member's next session check (US-CW-006 AC-05). Returns the prior role so the
   * caller can write the audit diff.
   */
  changeMemberRole(
    actorOrgId: string,
    memberId: string,
    patch: { role: Role; grantAdmin?: boolean },
    actorIsOwner = false,
  ): ChangeMemberRoleResult {
    const member = this.findMemberInOrg(actorOrgId, memberId);
    if (!member) return { outcome: 'member_not_found' };
    if (member.isOwner) return { outcome: 'owner_protected' };

    // Granting Admin is a delegation any Owner/Admin can make, but REVOKING it is Owner-only
    // (US-CW-031 AC-08): an Admin can never strip Admin — not from another Admin, nor from themselves —
    // so an Admin can't lock the org out of team management, and revocation stays a deliberate Owner
    // decision. The check is on the transition true→false, resolved server-side from the caller's own
    // session, never client claims.
    const revokingAdmin = patch.grantAdmin === false && member.isAdmin;
    if (revokingAdmin && !actorIsOwner) {
      return { outcome: 'admin_revoke_forbidden' };
    }

    const previousRole = member.role;
    const previousIsAdmin = member.isAdmin;
    member.role = patch.role;
    member.approvalLimit = defaultApprovalLimitForRole(patch.role);
    if (patch.grantAdmin !== undefined) member.isAdmin = patch.grantAdmin;

    return {
      outcome: 'ok',
      member: this.toTeamMember(member),
      previousRole,
      previousIsAdmin,
    };
  }

  /**
   * Remove a member from the organization (US-CW-031 AC-05). Gated to a member of the actor's own org.
   * The Owner can never be removed by anyone, including another Admin (US-CW-030 AC-03). On removal the
   * member's every session is revoked, so they're signed out on their next request, and their org
   * membership is cleared — they can only return via a fresh invite.
   */
  removeMember(actorOrgId: string, memberId: string): RemoveMemberResult {
    const member = this.findMemberInOrg(actorOrgId, memberId);
    if (!member) return { outcome: 'member_not_found' };
    if (member.isOwner) return { outcome: 'owner_protected' };

    const snapshot = this.toTeamMember(member);
    this.revokeFamiliesForEmail(member.email);
    member.orgId = null;

    return { outcome: 'ok', member: snapshot };
  }

  /**
   * Re-send a pending invite (US-CW-031 AC-09 / Design §18.1). Mints a fresh single-use token and
   * invalidates the old one — "Resend issues a fresh link and invalidates the old one" — restarting
   * the 7-day expiry window from now. The PendingInvite id is preserved so the roster row stays put.
   * Org-scoped; the raw token is returned to the caller but, as with createInvite, never surfaced over
   * the network.
   */
  async resendInvite(
    actorOrgId: string,
    inviteId: string,
    now: number = Date.now(),
  ): Promise<ResendInviteResult> {
    const found = this.findInviteInOrg(actorOrgId, inviteId);
    if (!found) return { outcome: 'invite_not_found' };

    this.invitesByTokenHash.delete(found.hash);
    const token = `invite_${crypto.randomUUID()}`;
    const refreshed: InviteTokenRecord = { ...found.record, issuedAt: now, used: false };
    this.invitesByTokenHash.set(await hashToken(token), refreshed);

    return { outcome: 'ok', token, invite: this.toPendingInvite(refreshed) };
  }

  /**
   * Revoke a pending invite (US-CW-031 AC-10 / Design §18.1). Deletes the outstanding invite so it
   * drops off the roster and its link can no longer be accepted (getInviteDetails/acceptInvite both
   * report it invalid). Org-scoped. Returns the invite as it was for the audit diff.
   */
  revokeInvite(actorOrgId: string, inviteId: string): RevokeInviteResult {
    const found = this.findInviteInOrg(actorOrgId, inviteId);
    if (!found) return { outcome: 'invite_not_found' };

    this.invitesByTokenHash.delete(found.hash);
    return { outcome: 'ok', invite: this.toPendingInvite(found.record) };
  }

  /** Locate a live (unaccepted) invite by its PendingInvite id within an org, with its map key for deletion. */
  private findInviteInOrg(
    orgId: string,
    inviteId: string,
  ): { hash: string; record: InviteTokenRecord } | undefined {
    for (const [hash, record] of this.invitesByTokenHash) {
      if (record.id === inviteId && record.orgId === orgId && !record.used) {
        return { hash, record };
      }
    }
    return undefined;
  }

  /** Project an invite record into the roster's PendingInvite shape (never exposes the token). */
  private toPendingInvite(record: InviteTokenRecord): PendingInvite {
    return {
      id: record.id,
      email: record.email,
      role: record.role,
      grantAdmin: record.grantAdmin,
      invitedAt: new Date(record.issuedAt).toISOString(),
    };
  }

  private findMemberInOrg(orgId: string, memberId: string): SeedUser | undefined {
    for (const user of this.usersByEmail.values()) {
      if (user.id === memberId && user.orgId === orgId) return user;
    }
    return undefined;
  }

  /** Revoke every active refresh-token family for an email — used when a member is removed (AC-05). */
  private revokeFamiliesForEmail(email: string): void {
    const key = email.toLowerCase();
    for (const family of this.familiesById.values()) {
      if (family.email === key && !family.revoked) {
        family.revoked = true;
        family.revokedReason = 'reuse_detected';
      }
    }
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

    const user = this.usersByEmail.get(family.email)!;
    return {
      outcome: 'active',
      userId: user.id,
      email: family.email,
      displayName: user.displayName,
      role: user.role,
      approvalLimit: user.approvalLimit,
      isAdmin: user.isAdmin,
      isOwner: user.isOwner,
      avatarUrl: user.avatarUrl ?? null,
    };
  }

  /**
   * Applies a role/limit/admin change to a user in place — the mid-session change an admin makes
   * (US-CW-006 AC-05). Keyed by email. Because checkSession re-reads the live user record on every
   * request, the very next session check reflects this without the user re-logging in. A no-op for
   * an unknown email.
   */
  setUserRole(
    email: string,
    patch: { role?: Role; approvalLimit?: number | null; isAdmin?: boolean; isOwner?: boolean },
  ): void {
    const user = this.usersByEmail.get(email.toLowerCase());
    if (!user) return;
    if (patch.role !== undefined) user.role = patch.role;
    if (patch.approvalLimit !== undefined) user.approvalLimit = patch.approvalLimit;
    if (patch.isAdmin !== undefined) user.isAdmin = patch.isAdmin;
    if (patch.isOwner !== undefined) user.isOwner = patch.isOwner;
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
      // A freshly signed-up account defaults to the lowest tier — Employee, no approval authority,
      // not an admin. Role/limit changes are an administrative action modeled by setUserRole.
      this.usersByEmail.set(key, {
        id: `user_${crypto.randomUUID()}`,
        email: key,
        passwordHash,
        verified: false,
        displayName: key.split('@')[0] ?? key,
        role: 'employee',
        approvalLimit: null,
        isAdmin: false,
        isOwner: false,
        // No organization yet — a fresh sign-up joins one only by onboarding a business (which
        // provisions an org and makes them Owner, US-CW-030) or accepting an invite (US-CW-031).
        orgId: null,
        joinedAt: now,
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

  // ===========================================================================
  // Personal profile (US-CW-034). Every method is keyed by the caller's current
  // login email, which the HTTP handler reads from the authenticated session; a
  // null/no-op for an unknown email, mirroring setUserRole. The user record is
  // the single source of truth the sidebar identity footer also reads through
  // checkSession, so an avatar or name change surfaces there on the next fetch.
  // ===========================================================================

  private toProfile(user: SeedUser): ProfileResponse {
    return {
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone ?? null,
      jobTitle: user.jobTitle ?? null,
      avatarUrl: user.avatarUrl ?? null,
      pendingEmail: user.pendingEmail ?? null,
    };
  }

  /** The caller's editable identity + any pending email change (AC-01/03/05). Null for an unknown email. */
  getProfile(email: string): ProfileResponse | null {
    const user = this.usersByEmail.get(email.toLowerCase());
    return user ? this.toProfile(user) : null;
  }

  /** Updates name/phone/job title in place (AC-01). Returns the fresh profile, or null for unknown email. */
  updateProfile(
    email: string,
    patch: { displayName: string; phone: string | null; jobTitle: string | null },
  ): ProfileResponse | null {
    const user = this.usersByEmail.get(email.toLowerCase());
    if (!user) return null;
    user.displayName = patch.displayName;
    user.phone = patch.phone;
    user.jobTitle = patch.jobTitle;
    return this.toProfile(user);
  }

  /** Sets the avatar to a (cropped) data URL (AC-05). Returns the fresh profile, or null for unknown email. */
  setAvatar(email: string, avatarUrl: string): ProfileResponse | null {
    const user = this.usersByEmail.get(email.toLowerCase());
    if (!user) return null;
    user.avatarUrl = avatarUrl;
    return this.toProfile(user);
  }

  /** Clears the avatar, falling back to initials (AC-06). Returns the fresh profile, or null. */
  removeAvatar(email: string): ProfileResponse | null {
    const user = this.usersByEmail.get(email.toLowerCase());
    if (!user) return null;
    user.avatarUrl = null;
    return this.toProfile(user);
  }

  // ===========================================================================
  // Company Profile (US-CW-036). Org-scoped, keyed by orgId (the HTTP handler
  // resolves it from the caller's session and gates on org-profile:manage). The
  // KYB-verified identity (legalName, ein, structure) is read-only and never
  // written here; only the operational fields are mutable (AC-01/02).
  // ===========================================================================

  private toCompanyProfile(org: OrganizationRecord): CompanyProfileResponse {
    return {
      legalName: org.legalName,
      ein: org.ein,
      structure: org.structure ?? '',
      // Absent/true = verified (the seeded, KYB-approved case); only an explicit false is pending.
      verificationStatus: org.verified === false ? 'pending' : 'verified',
      primaryContactEmail: org.primaryContactEmail ?? '',
      addressLine1: org.addressLine1 ?? '',
      addressLine2: org.addressLine2 ?? '',
      city: org.city ?? '',
      state: org.state ?? '',
      postalCode: org.postalCode ?? '',
      fiscalYearStartMonth: org.fiscalYearStartMonth ?? 1,
    };
  }

  /** The org's company profile: KYB-locked identity + editable operational fields (AC-01/02). Null for an unknown org. */
  getCompanyProfile(orgId: string): CompanyProfileResponse | null {
    const org = this.orgsById.get(orgId);
    return org ? this.toCompanyProfile(org) : null;
  }

  /**
   * Updates only the editable operational fields in place (AC-01). The KYB identity (legalName, ein,
   * structure, verified) is deliberately not read from the patch, so a crafted request carrying those
   * cannot alter them (AC-02). Returns the fresh profile, or null for an unknown org.
   */
  updateCompanyProfile(
    orgId: string,
    patch: {
      primaryContactEmail: string;
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      postalCode: string;
      fiscalYearStartMonth: number;
    },
  ): CompanyProfileResponse | null {
    const org = this.orgsById.get(orgId);
    if (!org) return null;
    org.primaryContactEmail = patch.primaryContactEmail;
    org.addressLine1 = patch.addressLine1;
    org.addressLine2 = patch.addressLine2;
    org.city = patch.city;
    org.state = patch.state;
    org.postalCode = patch.postalCode;
    org.fiscalYearStartMonth = patch.fiscalYearStartMonth;
    return this.toCompanyProfile(org);
  }

  // ===========================================================================
  // Approval Policies & Spend Controls (US-CW-037). Org-scoped org-config, gated
  // by policies:manage in the handler. This is the single policy model the expense
  // routing + submission enforcement consume (AC-10) — editing here changes routing
  // and enforcement directly, via the ExpensesService policy provider.
  // ===========================================================================

  /** The org's approval-limit tiers, defaulting to the standard ladder when none has been saved. */
  getApprovalTiers(orgId: string): ApprovalPolicyTier[] | null {
    const org = this.orgsById.get(orgId);
    if (!org) return null;
    return org.approvalTiers ?? DEFAULT_APPROVAL_TIERS.map((tier) => ({ ...tier }));
  }

  /**
   * Persists a new tier ladder, assigning each tier a stable id (the client sends none). Callers must
   * validate coherence (no gap/overlap) before saving — the handler does via validateApprovalTiers.
   */
  setApprovalTiers(orgId: string, inputs: ApprovalPolicyTierInput[]): ApprovalPolicyTier[] | null {
    const org = this.orgsById.get(orgId);
    if (!org) return null;
    org.approvalTiers = inputs.map((input, index) => ({
      id: `tier_${orgId}_${index}`,
      minMinorUnits: input.minMinorUnits,
      maxMinorUnits: input.maxMinorUnits,
      approver: input.approver,
    }));
    return org.approvalTiers.map((tier) => ({ ...tier }));
  }

  /** The org's spend controls, coalesced to defaults (receipt $75, memo off, flag, no caps). */
  getSpendControls(orgId: string): StoredSpendControls | null {
    const org = this.orgsById.get(orgId);
    if (!org) return null;
    const stored = org.spendControls;
    return {
      receiptRequiredThresholdMinorUnits: stored?.receiptRequiredThresholdMinorUnits ?? 7_500,
      memoRequiredThresholdMinorUnits: stored?.memoRequiredThresholdMinorUnits ?? 0,
      outOfPolicyBehavior: stored?.outOfPolicyBehavior ?? 'flag',
      categoryCaps: { ...(stored?.categoryCaps ?? {}) },
    };
  }

  /** Persists spend controls in place. Returns the fresh controls, or null for an unknown org. */
  setSpendControls(orgId: string, patch: StoredSpendControls): StoredSpendControls | null {
    const org = this.orgsById.get(orgId);
    if (!org) return null;
    org.spendControls = {
      receiptRequiredThresholdMinorUnits: patch.receiptRequiredThresholdMinorUnits,
      memoRequiredThresholdMinorUnits: patch.memoRequiredThresholdMinorUnits,
      outOfPolicyBehavior: patch.outOfPolicyBehavior,
      categoryCaps: { ...patch.categoryCaps },
    };
    return this.getSpendControls(orgId);
  }

  private isEmailChangeTokenExpired(issuedAt: number, now: number): boolean {
    return now - issuedAt > EMAIL_CHANGE_TTL_MS;
  }

  private userById(userId: string): SeedUser | undefined {
    for (const user of this.usersByEmail.values()) {
      if (user.id === userId) return user;
    }
    return undefined;
  }

  private invalidateEmailChangeTokensFor(userId: string): void {
    for (const record of this.emailChangeTokensByTokenHash.values()) {
      if (record.userId === userId && !record.used) record.used = true;
    }
  }

  /**
   * Swaps a user's login email everywhere it is used as a key: the usersByEmail map, every
   * refresh-token family's `email` (checkSession resolves the user by it), and any failed-attempt
   * bucket. `newKey` is already normalized (lowercased/trimmed).
   */
  private rekeyUserEmail(user: SeedUser, newKey: string): void {
    const oldKey = user.email.toLowerCase();
    user.email = newKey;
    if (oldKey === newKey) return;
    this.usersByEmail.delete(oldKey);
    this.usersByEmail.set(newKey, user);
    for (const family of this.familiesById.values()) {
      if (family.email === oldKey) family.email = newKey;
    }
    const attempts = this.failedAttemptsByEmail.get(oldKey);
    if (attempts) {
      this.failedAttemptsByEmail.delete(oldKey);
      this.failedAttemptsByEmail.set(newKey, attempts);
    }
  }

  /**
   * Begins a verified email change (AC-03). Rejects a malformed address, the current address, or one
   * already claimed by another account. On success it mints a single-use token (hash stored, raw
   * token returned like requestPasswordReset — it stands in for the emailed link), records the
   * pending address on the user for the "Pending" indicator, and supersedes any prior outstanding
   * token so only one pending address exists at a time (edge case). The login email is NOT changed
   * yet — it swaps only on confirmation, so the current address keeps working for login until then.
   */
  async requestEmailChange(
    email: string,
    newEmail: string,
    now: number = Date.now(),
  ): Promise<RequestEmailChangeServiceResult> {
    const user = this.usersByEmail.get(email.toLowerCase());
    if (!user) return { outcome: 'invalid_email' };
    if (!isValidEmail(newEmail)) return { outcome: 'invalid_email' };
    if (isSameEmail(newEmail, user.email)) return { outcome: 'same_as_current' };

    const newKey = newEmail.trim().toLowerCase();
    const claimant = this.usersByEmail.get(newKey);
    if (claimant && claimant.id !== user.id) return { outcome: 'email_taken' };

    this.invalidateEmailChangeTokensFor(user.id);

    const token = `emailchange_${crypto.randomUUID()}`;
    const tokenHash = await hashToken(token);
    this.emailChangeTokensByTokenHash.set(tokenHash, {
      userId: user.id,
      newEmail: newKey,
      issuedAt: now,
      used: false,
    });
    user.pendingEmail = newKey;
    this.notificationsSent.push({ type: 'email_change_requested', email: newKey, timestamp: now });
    return { outcome: 'success', token, pendingEmail: newKey };
  }

  async isEmailChangeTokenValid(token: string, now: number = Date.now()): Promise<boolean> {
    const record = this.emailChangeTokensByTokenHash.get(await hashToken(token));
    return !!record && !record.used && !this.isEmailChangeTokenExpired(record.issuedAt, now);
  }

  /**
   * Applies a pending email change (AC-03/04). On success it swaps the login email — re-keying the
   * user map and every refresh-token family so checkSession/login resolve the new address — clears
   * the pending marker, and consumes the token. An expired or already-used/invalid token leaves the
   * current email untouched (AC-04); an expired link additionally clears the now-stale pending
   * marker so the profile no longer advertises a change that can never complete.
   */
  async confirmEmailChange(
    token: string,
    now: number = Date.now(),
  ): Promise<ConfirmEmailChangeServiceResult> {
    const record = this.emailChangeTokensByTokenHash.get(await hashToken(token));
    if (!record || record.used) return { outcome: 'token_invalid' };

    if (this.isEmailChangeTokenExpired(record.issuedAt, now)) {
      record.used = true;
      const staleUser = this.userById(record.userId);
      if (staleUser && staleUser.pendingEmail === record.newEmail) staleUser.pendingEmail = null;
      return { outcome: 'token_expired' };
    }

    const user = this.userById(record.userId);
    if (!user) return { outcome: 'token_invalid' };

    // The address may have been claimed by another account between request and confirm — refuse
    // rather than collide two logins on one key.
    const claimant = this.usersByEmail.get(record.newEmail);
    if (claimant && claimant.id !== user.id) {
      record.used = true;
      user.pendingEmail = null;
      return { outcome: 'token_invalid' };
    }

    this.rekeyUserEmail(user, record.newEmail);
    user.pendingEmail = null;
    record.used = true;
    return { outcome: 'success', email: user.email };
  }

  /** Cancels an outstanding email change (AC-03 "Cancel change"): clears the marker + invalidates the token. */
  cancelEmailChange(email: string): ProfileResponse | null {
    const user = this.usersByEmail.get(email.toLowerCase());
    if (!user) return null;
    this.invalidateEmailChangeTokensFor(user.id);
    user.pendingEmail = null;
    return this.toProfile(user);
  }

  /** The caller's notification preferences, lazily defaulting a fresh account to all-on/instant (AC-07). */
  getNotificationPrefs(email: string): NotificationPreference[] | null {
    const user = this.usersByEmail.get(email.toLowerCase());
    if (!user) return null;
    if (!user.notificationPrefs) user.notificationPrefs = defaultNotificationPrefs();
    return user.notificationPrefs;
  }

  /** Sets one notification row, auto-saved per interaction (AC-07/08). Returns the full set, or null. */
  setNotificationPref(
    email: string,
    key: NotificationTypeKey,
    patch: { email: boolean; inApp: boolean; frequency: NotificationFrequency },
  ): NotificationPreference[] | null {
    const prefs = this.getNotificationPrefs(email);
    if (!prefs) return null;
    const row = prefs.find((pref) => pref.key === key);
    if (row) {
      row.email = patch.email;
      row.inApp = patch.inApp;
      row.frequency = patch.frequency;
    }
    return prefs;
  }

  /** Bulk-applies a frequency to every frequency-supporting row (AC-09). Returns the full set, or null. */
  applyNotificationSummary(
    email: string,
    frequency: NotificationFrequency,
  ): NotificationPreference[] | null {
    const user = this.usersByEmail.get(email.toLowerCase());
    if (!user) return null;
    const prefs = this.getNotificationPrefs(email)!;
    user.notificationPrefs = applyNotificationSummaryPolicy(prefs, frequency);
    return user.notificationPrefs;
  }

  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog;
  }

  getSentNotifications(): readonly NotificationEvent[] {
    return this.notificationsSent;
  }

  // ===========================================================================
  // Account security (US-CW-035). All self-service and keyed by the caller's own
  // login email (the handler reads it from the authenticated session); a null /
  // 'unknown_user' outcome for an unknown email. The 2FA secret and backup-code
  // hashes never leave the server; audit events are emitted by the handler layer.
  // ===========================================================================

  /**
   * Change the caller's password (AC-01/02). Rejects a wrong current password or a new password below
   * the strict sign-up strength bar (>= 12 chars, mixed case, number, symbol). Deliberately does NOT
   * revoke the caller's other sessions — a self-service change is not a compromise signal, unlike a
   * password RESET (contrast resetPassword, US-CW-003). Other sessions persist until explicitly revoked.
   */
  async changePassword(
    email: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<ChangePasswordResult> {
    const user = this.usersByEmail.get(email.toLowerCase());
    if (!user) return { outcome: 'unknown_user' };
    const matches = await verifyPassword(currentPassword, user.passwordHash);
    if (!matches) return { outcome: 'incorrect_password' };
    if (!isValidSignUpPassword(newPassword)) return { outcome: 'weak_password' };
    user.passwordHash = await hashPassword(newPassword);
    return { outcome: 'success' };
  }

  private isOrgTwoFactorEnforced(email: string): boolean {
    const user = this.usersByEmail.get(email.toLowerCase());
    const org = user?.orgId ? this.orgsById.get(user.orgId) : undefined;
    return org?.enforceTwoFactor ?? false;
  }

  /**
   * Resolve the caller's user record and lazily initialise their security state. The security maps are
   * seeded only for the accounts present at construction; a user created afterwards (sign-up US-CW-029,
   * invite acceptance US-CW-031) has no entry until they first visit this surface — without this they'd
   * get spurious 401s on every /api/security call. Returns the user with all three security entries
   * guaranteed present, or null for a genuinely unknown email.
   */
  private ensureSecurityState(email: string, now: number = Date.now()): SeedUser | null {
    const key = email.toLowerCase();
    const user = this.usersByEmail.get(key);
    if (!user) return null;
    if (!this.twoFactorByEmail.has(key)) this.twoFactorByEmail.set(key, defaultTwoFactor());
    if (!this.deviceSessionsByEmail.has(key))
      this.deviceSessionsByEmail.set(key, [defaultCurrentSession(now)]);
    if (!this.trustedDevicesByEmail.has(key)) this.trustedDevicesByEmail.set(key, []);
    return user;
  }

  /** The caller's 2FA status plus whether their org mandates it (AC-07). Null for an unknown email. */
  getTwoFactorStatus(email: string): TwoFactorStatus | null {
    if (!this.ensureSecurityState(email)) return null;
    const tf = this.twoFactorByEmail.get(email.toLowerCase())!;
    return { enabled: tf.enabled, orgEnforced: this.isOrgTwoFactorEnforced(email) };
  }

  /**
   * Begin TOTP setup (AC-03): mint a fresh secret, stash it as pending (NOT yet active — the account
   * stays 2FA-off until a correct code is verified, AC-05), and return the secret + otpauth URI so the
   * client can render the QR locally. Re-invoking replaces any prior pending secret. Null for unknown email.
   */
  startTotpSetup(email: string): { secret: string; otpauthUri: string } | null {
    const key = email.toLowerCase();
    const user = this.ensureSecurityState(key);
    if (!user) return null;
    const tf = this.twoFactorByEmail.get(key)!;
    const secret = generateTotpSecret();
    tf.pendingSecret = secret;
    return { secret, otpauthUri: buildOtpauthUri({ secret, accountName: user.email }) };
  }

  /**
   * Complete TOTP setup by verifying a 6-digit code against the pending secret (AC-04/05). On success,
   * activate 2FA and return ten one-time backup codes (shown exactly once — only their hashes are kept,
   * AC-06). On a wrong code, the secret stays pending/unverified so 2FA cannot be enabled (AC-05).
   */
  async verifyTotpSetup(
    email: string,
    code: string,
    now: number = Date.now(),
  ): Promise<VerifyTotpSetupResult> {
    if (!this.ensureSecurityState(email)) return { outcome: 'unknown_user' };
    const tf = this.twoFactorByEmail.get(email.toLowerCase())!;
    if (!tf.pendingSecret) return { outcome: 'no_pending_setup' };
    const valid = await verifyTotpCode(tf.pendingSecret, code, now);
    if (!valid) return { outcome: 'incorrect_code' };
    const backupCodes = generateBackupCodes();
    tf.secret = tf.pendingSecret;
    tf.pendingSecret = null;
    tf.enabled = true;
    tf.backupCodeHashes = await Promise.all(backupCodes.map((c) => hashToken(c)));
    return { outcome: 'success', backupCodes };
  }

  /**
   * Disable 2FA (AC-07). Refused with `org_enforced` when the org mandates it — the client also hides
   * the control, but the server independently decides (client-hides-server-decides). Disabling voids all
   * trusted-device exemptions, which only make sense while 2FA is on.
   */
  disableTwoFactor(email: string): DisableTwoFactorResult {
    const key = email.toLowerCase();
    if (!this.ensureSecurityState(key)) return { outcome: 'unknown_user' };
    const tf = this.twoFactorByEmail.get(key)!;
    if (this.isOrgTwoFactorEnforced(email)) return { outcome: 'org_enforced' };
    tf.enabled = false;
    tf.secret = null;
    tf.backupCodeHashes = [];
    tf.pendingSecret = null;
    this.trustedDevicesByEmail.set(key, []);
    return { outcome: 'success' };
  }

  private toDeviceSession(session: StoredDeviceSession): DeviceSession {
    return {
      id: session.id,
      deviceType: session.deviceType,
      browser: session.browser,
      os: session.os,
      city: session.city,
      country: session.country,
      lastActiveAt: new Date(session.lastActiveAt).toISOString(),
      current: session.current,
    };
  }

  /** The caller's active sessions, most-recently-active first (AC-08). Null for an unknown email. */
  listSessions(email: string): DeviceSession[] | null {
    if (!this.ensureSecurityState(email)) return null;
    const list = this.deviceSessionsByEmail.get(email.toLowerCase())!;
    return [...list]
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .map((session) => this.toDeviceSession(session));
  }

  /**
   * Revoke a single OTHER session by id (AC-09). The current session can never be revoked here — the
   * server refuses even if the client sends its id (AC-08). Idempotent: returns false (not an error)
   * when the session is already gone, so a concurrent double-revoke surfaces no error to the user.
   */
  revokeSession(email: string, sessionId: string): boolean {
    if (!this.ensureSecurityState(email)) return false;
    const list = this.deviceSessionsByEmail.get(email.toLowerCase())!;
    const index = list.findIndex((session) => session.id === sessionId && !session.current);
    if (index === -1) return false;
    list.splice(index, 1);
    return true;
  }

  /** Revoke every session except the caller's current one (AC-09). Returns how many were revoked. */
  revokeOtherSessions(email: string): number | null {
    const key = email.toLowerCase();
    if (!this.ensureSecurityState(key)) return null;
    const list = this.deviceSessionsByEmail.get(key)!;
    const revokedCount = list.filter((session) => !session.current).length;
    this.deviceSessionsByEmail.set(
      key,
      list.filter((session) => session.current),
    );
    return revokedCount;
  }

  private toTrustedDevice(device: StoredTrustedDevice): TrustedDevice {
    return {
      id: device.id,
      label: device.label,
      trustedAt: new Date(device.trustedAt).toISOString(),
      lastUsedAt: new Date(device.lastUsedAt).toISOString(),
    };
  }

  /** The caller's trusted-device exemptions (AC-10). Null for an unknown email. */
  listTrustedDevices(email: string): TrustedDevice[] | null {
    if (!this.ensureSecurityState(email)) return null;
    const list = this.trustedDevicesByEmail.get(email.toLowerCase())!;
    return list.map((device) => this.toTrustedDevice(device));
  }

  /**
   * Remove a trusted-device exemption (AC-10) so that device's next login re-prompts for 2FA. Idempotent:
   * returns false when it's already gone.
   */
  removeTrustedDevice(email: string, deviceId: string): boolean {
    if (!this.ensureSecurityState(email)) return false;
    const list = this.trustedDevicesByEmail.get(email.toLowerCase())!;
    const index = list.findIndex((device) => device.id === deviceId);
    if (index === -1) return false;
    list.splice(index, 1);
    return true;
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
      emailChangeTokens: [...this.emailChangeTokensByTokenHash],
      inviteTokens: [...this.invitesByTokenHash],
      organizations: [...this.orgsById],
      refreshTokenFamilies: [...this.familiesById.values()].map((family) => ({
        ...family,
        usedTokenHashes: [...family.usedTokenHashes],
      })),
      notifications: [...this.notificationsSent],
      twoFactor: [...this.twoFactorByEmail],
      deviceSessions: [...this.deviceSessionsByEmail],
      trustedDevices: [...this.trustedDevicesByEmail],
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

    // `?? []` for backward compatibility with a snapshot taken before email-change existed.
    this.emailChangeTokensByTokenHash.clear();
    (snapshot.emailChangeTokens ?? []).forEach(([hash, record]) =>
      this.emailChangeTokensByTokenHash.set(hash, record),
    );

    this.invitesByTokenHash.clear();
    (snapshot.inviteTokens ?? []).forEach(([hash, record]) =>
      this.invitesByTokenHash.set(hash, record),
    );

    // Organizations + the EIN index are rebuilt from the snapshot when present; a snapshot predating
    // team management (no organizations key) leaves the seeded orgs in place rather than wiping them.
    if (snapshot.organizations) {
      this.orgsById.clear();
      this.orgIdByEin.clear();
      snapshot.organizations.forEach(([id, record]) => {
        this.orgsById.set(id, record);
        this.orgIdByEin.set(record.ein, id);
      });
    }

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

    // Security state (US-CW-035): rebuilt from the snapshot when present; a snapshot predating it
    // leaves the constructor-seeded state in place rather than wiping it.
    if (snapshot.twoFactor) {
      this.twoFactorByEmail.clear();
      snapshot.twoFactor.forEach(([email, record]) => this.twoFactorByEmail.set(email, record));
    }
    if (snapshot.deviceSessions) {
      this.deviceSessionsByEmail.clear();
      snapshot.deviceSessions.forEach(([email, list]) =>
        this.deviceSessionsByEmail.set(email, list),
      );
    }
    if (snapshot.trustedDevices) {
      this.trustedDevicesByEmail.clear();
      snapshot.trustedDevices.forEach(([email, list]) =>
        this.trustedDevicesByEmail.set(email, list),
      );
    }
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
