import type { Role } from './rbac';

/**
 * An Organization — the durable account entity a business gets when its KYB onboarding is approved
 * (US-CW-030). Keyed to the business it was created for (legal name + EIN), distinct from any single
 * user's login. Members are linked to it by `orgId`; it always has exactly one Owner.
 */
export interface Organization {
  id: string;
  legalName: string;
  ein: string;
  /** ISO-8601 timestamp the organization was provisioned (KYB approval). */
  createdAt: string;
}

/**
 * A current member of an organization, as the Team roster shows them (Design §18.1). `isOwner`/`isAdmin`
 * are the orthogonal team-administration flags; `role` is the approval tier. The Owner is a per-org
 * singleton that can never be removed or demoted (US-CW-030 AC-03).
 */
export interface TeamMember {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  isAdmin: boolean;
  isOwner: boolean;
  /** ISO-8601 timestamp the member joined the organization. */
  joinedAt: string;
}

/**
 * An outstanding invitation that has been sent but not yet accepted (Design §18.1 "Pending" row). The
 * underlying single-use token is never exposed here — only the invitee email, the role they'll get,
 * and when it was sent.
 */
export interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  /** Whether accepting also grants the orthogonal Admin permission. */
  grantAdmin: boolean;
  /** ISO-8601 timestamp the invite was sent — a 7-day expiry runs from here (US-CW-031 AC-03). */
  invitedAt: string;
}

/** GET /api/team/members — the roster an Owner/Admin sees: current members plus pending invites. */
export interface TeamRosterResponse {
  organizationId: string;
  organizationName: string;
  members: TeamMember[];
  invites: PendingInvite[];
}

/** POST /api/team/invites — invite a teammate by work email with an assigned role (US-CW-031 AC-01). */
export interface InviteMemberRequest {
  email: string;
  role: Role;
  /** Also grant the orthogonal Admin permission (Design §18.2 "Also grant Admin"). */
  grantAdmin: boolean;
}

/**
 * Body of a successful invite. Deliberately empty and identical whether or not the email already had a
 * Clearline account — the enumeration-safe response US-CW-031 AC-01 requires, mirroring sign-up. The
 * confirmation copy's role is what the caller submitted, so nothing account-revealing comes back.
 */
export type InviteMemberResponse = Record<string, never>;

/**
 * GET /api/team/invites/:token — what the invite-acceptance page shows before a password is set
 * (Design §18.3). `status` drives which screen renders; the detail fields are present only when valid.
 */
export interface InviteDetailsResponse {
  status: 'valid' | 'expired' | 'invalid';
  /** Present only when status is 'valid'. */
  inviterName?: string;
  organizationName?: string;
  role?: Role;
  email?: string;
}

/** POST /api/team/invites/:token/accept — a brand-new invitee sets a password to join (US-CW-031 AC-02). */
export interface AcceptInviteRequest {
  password: string;
}

export type AcceptInviteOutcome = 'success' | 'invite_expired' | 'invite_invalid' | 'weak_password';

/**
 * Body of an invite acceptance. On 'success' an access token is returned and the refresh cookie is set
 * (same auto-login as email verification), and the invitee lands on their role-appropriate dashboard —
 * never business onboarding, which is a per-organization step the Owner already completed (AC-02).
 */
export interface AcceptInviteResponse {
  outcome: AcceptInviteOutcome;
  /** Present only when outcome is 'success'. */
  accessToken?: string;
}

/**
 * PATCH /api/team/members/:id/role — change an existing member's approval tier (US-CW-031 AC-04) and
 * optionally grant or revoke the orthogonal Admin permission (AC-08). Granting Admin is available to
 * any Owner/Admin; revoking Admin is Owner-only (an Admin can delegate Admin but never strip it).
 */
export interface ChangeMemberRoleRequest {
  role: Role;
  /** Flip the orthogonal Admin permission alongside the tier change; omitted leaves it unchanged. */
  grantAdmin?: boolean;
}

export interface ChangeMemberRoleResponse {
  member: TeamMember;
}

/**
 * Body of a 403/404 from a team-management endpoint — the client maps `error` to inline copy.
 * `forbidden_role`: caller is neither Owner nor Admin (US-CW-031 AC-07). `owner_protected`: the target
 * is the Owner, who can't be removed or demoted (US-CW-030 AC-03). `admin_revoke_forbidden`: a non-Owner
 * tried to revoke Admin, which only the Owner may do (US-CW-031 AC-08). `member_not_found`: unknown member.
 * `invite_not_found`: the pending invite being resent or revoked no longer exists (US-CW-031 AC-09/AC-10).
 */
export interface TeamErrorResponse {
  error:
    | 'forbidden_role'
    | 'owner_protected'
    | 'admin_revoke_forbidden'
    | 'member_not_found'
    | 'invite_not_found';
}
