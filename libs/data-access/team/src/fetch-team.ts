import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  ChangeMemberRoleRequest,
  ChangeMemberRoleResponse,
  InviteMemberRequest,
  TeamRosterResponse,
} from '@clearline/contracts';
import { TeamForbiddenError } from './team-forbidden-error';

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
