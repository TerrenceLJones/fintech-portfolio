import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  AcceptInviteRequest,
  AcceptInviteResponse,
  ChangeMemberRoleRequest,
  ChangeMemberRoleResponse,
  InviteDetailsResponse,
  InviteMemberRequest,
  InviteMemberResponse,
  Role,
  TeamErrorResponse,
  TeamRosterResponse,
} from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import { AuthService } from '../services/auth.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { AuditService } from '../services/audit.service';
import { sharedAuditService } from '../services/shared-audit-service';
import { resolveAuditActor } from './audit-actor';
import { bearerToken, unauthorizedForSession } from './session-auth';

const REFRESH_COOKIE = 'refreshToken';

/** The same Set-Cookie shape login/verify-email use — the invite-accept auto-login (US-CW-031 AC-02). */
function setRefreshCookie(token: string): string {
  return `${REFRESH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`;
}

/** Human labels for the audit diff's before/after role values (Design §18.4). */
const ROLE_LABEL: Record<Role, string> = {
  employee: 'Employee',
  finance_manager: 'Finance Manager',
  controller: 'Controller',
};

/**
 * The acting Owner/Admin's session context — their id/name (for audit + inviter display) and the
 * organization they administer. Null when there's no active team:view-holding session.
 */
interface TeamActor {
  userId: string;
  displayName: string;
  orgId: string;
  /** Whether the acting administrator is the organization's Owner — gates Admin revocation (AC-08). */
  isOwner: boolean;
}

function forbidden() {
  const body: TeamErrorResponse = { error: 'forbidden_role' };
  return HttpResponse.json(body, { status: 403 });
}

/**
 * Thin HTTP adapter for team management (US-CW-031). Every roster/invite/role/removal endpoint
 * independently re-checks `team:view` (granted only by Owner or Admin) server-side — the client route
 * guard is never the security boundary, so a non-Owner/Admin gets a 403 regardless of UI state
 * (AC-07). Invite validation + acceptance are deliberately public: the invitee has no session yet.
 */
export function createTeamHandlers(
  authService: AuthService = sharedAuthService,
  auditService: AuditService = sharedAuditService,
): HttpHandler[] {
  /**
   * Resolve the caller as a team administrator: an active session that holds `team:view` (Owner or
   * Admin) and belongs to an organization. Returns the actor, or a Response to short-circuit with —
   * 401 when unauthenticated, 403 when authenticated but not an Owner/Admin.
   */
  function authorizeAdmin(request: Request): { actor: TeamActor } | { fail: Response } {
    const accessToken = bearerToken(request);
    const session = accessToken ? authService.checkSession(accessToken) : null;
    if (!session || session.outcome !== 'active') {
      return { fail: unauthorizedForSession(request, authService) };
    }
    const permissions = permissionsForRole(session.role!, {
      isAdmin: session.isAdmin!,
      isOwner: session.isOwner!,
    });
    const orgId = authService.getOrgIdForUser(session.userId!);
    if (!hasPermission(permissions, 'team:view') || !orgId) {
      return { fail: forbidden() };
    }
    return {
      actor: {
        userId: session.userId!,
        displayName: session.displayName!,
        orgId,
        isOwner: session.isOwner!,
      },
    };
  }

  return [
    // Roster — Owner/Admin only (AC-07). Also the endpoint the client route guard probes.
    http.get('*/api/team/members', ({ request }) => {
      const result = authorizeAdmin(request);
      if ('fail' in result) return result.fail;

      const roster = authService.getTeamRoster(result.actor.orgId);
      if (!roster) return forbidden();
      const body: TeamRosterResponse = roster;
      return HttpResponse.json(body, { status: 200 });
    }),

    // Invite a teammate — enumeration-safe, always 200 with the same empty body (AC-01).
    http.post('*/api/team/invites', async ({ request }) => {
      const result = authorizeAdmin(request);
      if ('fail' in result) return result.fail;

      const { email, role, grantAdmin } = (await request.json()) as InviteMemberRequest;
      await authService.createInvite({
        orgId: result.actor.orgId,
        email,
        role,
        grantAdmin,
        inviterName: result.actor.displayName,
      });
      const body: InviteMemberResponse = {};
      return HttpResponse.json(body, { status: 200 });
    }),

    // Invite details for the acceptance page — public (the invitee has no session).
    http.get('*/api/team/invites/:token', async ({ params }) => {
      const details = await authService.getInviteDetails(String(params.token));
      const body: InviteDetailsResponse = details;
      return HttpResponse.json(body, { status: 200 });
    }),

    // Accept an invite — public; on success auto-logs the invitee in (AC-02).
    http.post('*/api/team/invites/:token/accept', async ({ request, params }) => {
      const { password } = (await request.json()) as AcceptInviteRequest;
      const result = await authService.acceptInvite(String(params.token), password);

      if (result.outcome === 'success') {
        const body: AcceptInviteResponse = { outcome: 'success', accessToken: result.accessToken! };
        return HttpResponse.json(body, {
          status: 200,
          headers: { 'set-cookie': setRefreshCookie(result.refreshToken!) },
        });
      }
      const body: AcceptInviteResponse = { outcome: result.outcome };
      return HttpResponse.json(body, { status: 200 });
    }),

    // Resend a pending invite — Owner/Admin only. A fresh single-use link supersedes and invalidates
    // the old one; the token itself is never returned (enumeration-safe, same as the create endpoint).
    http.post('*/api/team/invites/:id/resend', async ({ request, params }) => {
      const result = authorizeAdmin(request);
      if ('fail' in result) return result.fail;

      const outcome = await authService.resendInvite(result.actor.orgId, String(params.id));
      if (outcome.outcome !== 'ok') return teamMutationError(outcome.outcome);

      // A re-issued invite is a team change too — audit it (Design §18.4).
      const actor = resolveAuditActor(request, authService);
      if (actor) {
        auditService.record({
          actor,
          category: 'role_change',
          action: `Resent invite · ${outcome.invite!.email}`,
          target: { label: outcome.invite!.email, ref: outcome.invite!.id },
          diff: { from: 'Invited', to: 'Re-invited', tone: 'neutral' },
        });
      }

      const body: InviteMemberResponse = {};
      return HttpResponse.json(body, { status: 200 });
    }),

    // Revoke a pending invite — Owner/Admin only. The outstanding link can no longer be accepted (AC-10).
    http.delete('*/api/team/invites/:id', ({ request, params }) => {
      const result = authorizeAdmin(request);
      if ('fail' in result) return result.fail;

      const outcome = authService.revokeInvite(result.actor.orgId, String(params.id));
      if (outcome.outcome !== 'ok') return teamMutationError(outcome.outcome);

      const actor = resolveAuditActor(request, authService);
      if (actor) {
        auditService.record({
          actor,
          category: 'role_change',
          action: `Revoked invite · ${outcome.invite!.email}`,
          target: { label: outcome.invite!.email, ref: outcome.invite!.id },
          diff: { from: 'Invited', to: 'Revoked', tone: 'negative' },
        });
      }

      return new HttpResponse(null, { status: 204 });
    }),

    // Change a member's role — Owner/Admin only; Owner is protected (AC-04 / US-CW-030 AC-03).
    http.patch('*/api/team/members/:id/role', async ({ request, params }) => {
      const result = authorizeAdmin(request);
      if ('fail' in result) return result.fail;

      const { role, grantAdmin } = (await request.json()) as ChangeMemberRoleRequest;
      const outcome = authService.changeMemberRole(
        result.actor.orgId,
        String(params.id),
        { role, grantAdmin },
        result.actor.isOwner,
      );
      if (outcome.outcome !== 'ok') return teamMutationError(outcome.outcome);

      // Each permission change is auditable (AC-04/AC-08): a single PATCH can change the approval tier
      // and/or the orthogonal Admin flag, and each is recorded on its own with a prior → new diff.
      const actor = resolveAuditActor(request, authService);
      const member = outcome.member!;
      if (actor) {
        if (outcome.previousRole !== member.role) {
          auditService.record({
            actor,
            category: 'role_change',
            action: `Changed role · ${member.displayName}`,
            target: { label: member.displayName, ref: member.id },
            diff: {
              from: ROLE_LABEL[outcome.previousRole!],
              to: ROLE_LABEL[member.role],
              tone: 'neutral',
            },
          });
        }
        if (outcome.previousIsAdmin !== member.isAdmin) {
          const granted = member.isAdmin;
          auditService.record({
            actor,
            category: 'role_change',
            action: `${granted ? 'Granted' : 'Revoked'} Admin · ${member.displayName}`,
            target: { label: member.displayName, ref: member.id },
            diff: {
              from: outcome.previousIsAdmin ? 'Admin' : 'Member',
              to: member.isAdmin ? 'Admin' : 'Member',
              tone: granted ? 'neutral' : 'warning',
            },
          });
        }
      }

      const body: ChangeMemberRoleResponse = { member };
      return HttpResponse.json(body, { status: 200 });
    }),

    // Remove a member — Owner/Admin only; Owner can never be removed (AC-05 / US-CW-030 AC-03).
    http.delete('*/api/team/members/:id', ({ request, params }) => {
      const result = authorizeAdmin(request);
      if ('fail' in result) return result.fail;

      const outcome = authService.removeMember(result.actor.orgId, String(params.id));
      if (outcome.outcome !== 'ok') return teamMutationError(outcome.outcome);

      const actor = resolveAuditActor(request, authService);
      if (actor) {
        auditService.record({
          actor,
          category: 'role_change',
          action: `Removed member · ${outcome.member!.displayName}`,
          target: { label: outcome.member!.displayName, ref: outcome.member!.id },
          diff: { from: ROLE_LABEL[outcome.member!.role], to: 'Removed', tone: 'negative' },
        });
      }

      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

/** Map a service-level team mutation failure to its HTTP response: 404 for an unknown member/invite, 403 otherwise. */
function teamMutationError(
  outcome: 'owner_protected' | 'admin_revoke_forbidden' | 'member_not_found' | 'invite_not_found',
): Response {
  const body: TeamErrorResponse = { error: outcome };
  const notFound = outcome === 'member_not_found' || outcome === 'invite_not_found';
  return HttpResponse.json(body, { status: notFound ? 404 : 403 });
}

export const teamHandlers = createTeamHandlers();
