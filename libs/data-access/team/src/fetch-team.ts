import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  ChangeMemberRoleRequest,
  ChangeMemberRoleResponse,
  InviteMemberRequest,
  TeamErrorResponse,
  TeamRosterResponse,
  TransferOwnershipRequest,
  TransferOwnershipResponse,
} from '@clearline/contracts';
import { TeamForbiddenError } from './team-forbidden-error';
import { TransferOwnershipError } from './transfer-ownership-error';

/** Fetch the team roster. A 403 becomes TeamForbiddenError (access-denied); any other non-2xx throws. */
export async function fetchTeamRoster(): Promise<TeamRosterResponse> {
  const response = await authenticatedFetch('/api/team/members');
  if (response.status === 403) {
    throw new TeamForbiddenError();
  }
  if (!response.ok) {
    throw new Error('team_roster_failed');
  }
  return response.json() as Promise<TeamRosterResponse>;
}

/** Send an invite. The response is enumeration-safe (always empty on success); a 403 is a forbidden caller. */
export async function postInvite(request: InviteMemberRequest): Promise<void> {
  const response = await authenticatedFetch('/api/team/invites', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (response.status === 403) {
    throw new TeamForbiddenError();
  }
  if (!response.ok) {
    throw new Error('team_invite_failed');
  }
}

/** Change a member's role. 403 = forbidden caller or the protected Owner; 404 = unknown member. */
export async function patchMemberRole(
  memberId: string,
  request: ChangeMemberRoleRequest,
): Promise<ChangeMemberRoleResponse> {
  const response = await authenticatedFetch(
    `/api/team/members/${encodeURIComponent(memberId)}/role`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
  if (response.status === 403) {
    throw new TeamForbiddenError();
  }
  if (!response.ok) {
    throw new Error('team_role_change_failed');
  }
  return response.json() as Promise<ChangeMemberRoleResponse>;
}

/** Remove a member (204 No Content). 403 = forbidden caller or the protected Owner; 404 = unknown member. */
export async function deleteMember(memberId: string): Promise<void> {
  const response = await authenticatedFetch(`/api/team/members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
  });
  if (response.status === 403) {
    throw new TeamForbiddenError();
  }
  if (!response.ok) {
    throw new Error('team_remove_failed');
  }
}

/**
 * Transfer ownership to another current member (US-CW-043). On failure the server's specific reason is
 * mapped to a typed TransferOwnershipError so the UI can name it (AC-07); the roster's own `team:view`
 * 403 (a non-Owner/Admin caller) still surfaces as TeamForbiddenError.
 */
export async function postOwnerTransfer(
  request: TransferOwnershipRequest,
): Promise<TransferOwnershipResponse> {
  const response = await authenticatedFetch('/api/team/owner-transfer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (response.ok) {
    return response.json() as Promise<TransferOwnershipResponse>;
  }
  const body = (await response.json().catch(() => null)) as TeamErrorResponse | null;
  const code = body?.error;
  if (
    code === 'not_owner' ||
    code === 'reauth_failed' ||
    code === 'member_not_found' ||
    code === 'invalid_transfer_target'
  ) {
    throw new TransferOwnershipError(code);
  }
  throw new Error('owner_transfer_failed');
}

/** Resend a pending invite — a fresh link supersedes the old one (US-CW-031 AC-09). 403 = forbidden caller; 404 = unknown invite. */
export async function postInviteResend(inviteId: string): Promise<void> {
  const response = await authenticatedFetch(
    `/api/team/invites/${encodeURIComponent(inviteId)}/resend`,
    { method: 'POST' },
  );
  if (response.status === 403) {
    throw new TeamForbiddenError();
  }
  if (!response.ok) {
    throw new Error('team_invite_resend_failed');
  }
}

/** Revoke a pending invite (204 No Content) so its link can no longer be accepted (US-CW-031 AC-10). 403 = forbidden caller; 404 = unknown invite. */
export async function deleteInvite(inviteId: string): Promise<void> {
  const response = await authenticatedFetch(`/api/team/invites/${encodeURIComponent(inviteId)}`, {
    method: 'DELETE',
  });
  if (response.status === 403) {
    throw new TeamForbiddenError();
  }
  if (!response.ok) {
    throw new Error('team_invite_revoke_failed');
  }
}
