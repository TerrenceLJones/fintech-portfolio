import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { PendingInvite, Role, TeamMember } from '@clearline/contracts';
import {
  AccessDenied,
  Avatar,
  Button,
  Chip,
  ConfirmationDialog,
  EmptyState,
  Icon,
  Text,
} from '@clearline/ui';
import { ToastViewport } from '../../components/ToastViewport';
import { useToast } from '../../hooks/useToast';
import {
  TeamForbiddenError,
  useChangeMemberRole,
  useInviteMember,
  useRemoveMember,
  useResendInvite,
  useRevokeInvite,
  useTeamRoster,
} from '@clearline/data-access-team';
import { useAuthorization } from '@clearline/data-access-auth';
import { initialsFromName, roleLabel } from '../../rbac/identity';
import { InviteMemberModal, type InviteMemberValues } from './InviteMemberModal';
import { ChangeRoleDialog } from './ChangeRoleDialog';
import { GettingStartedSpotlight } from '../../components/GettingStartedSpotlight';
import { teamBeacon } from './TeamPage.beacon';
import { useDemoBeacon } from '@clearline/demo-beacon';

/** "2026-04-03T…" → "Apr 3". */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Team management surface for an Owner or Admin (US-CW-031 / Design §18.1). Lists current members and
 * pending invites, and drives the invite, role-change and removal flows. Every action is
 * independently authorized server-side — this UI only hides what the caller can't do; the server is
 * the boundary (AC-07). The Owner row is a protected singleton: no Remove is offered, and its reason
 * stays reachable to screen readers (US-CW-030 AC-03).
 */
export function TeamPage() {
  useDemoBeacon(teamBeacon);
  const navigate = useNavigate();
  const { isOwner } = useAuthorization();
  const roster = useTeamRoster();
  const inviteMember = useInviteMember();
  const changeRole = useChangeMemberRole();
  const removeMember = useRemoveMember();
  const resendInvite = useResendInvite();
  const revokeInvite = useRevokeInvite();

  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteRef = useRef<HTMLSpanElement>(null);
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PendingInvite | null>(null);
  // A resend leaves the row looking the same, so it confirms with a transient toast (design §7.2).
  const { toast, show: setToast } = useToast(4000);

  const summary = useMemo(() => {
    if (!roster.data) return '';
    const memberCount = roster.data.members.length;
    const inviteCount = roster.data.invites.length;
    const parts = [`${memberCount} member${memberCount === 1 ? '' : 's'}`];
    if (inviteCount > 0) parts.push(`${inviteCount} pending invite${inviteCount === 1 ? '' : 's'}`);
    parts.push(roster.data.organizationName);
    return parts.join(' · ');
  }, [roster.data]);

  if (roster.error instanceof TeamForbiddenError) {
    return (
      <AccessDenied
        message="Ask an admin if you need it. Team management is available to Owners and Admins."
        requestLine="403 Forbidden · GET /api/team/members"
        actionLabel="Back to My Expenses"
        onAction={() => navigate('/')}
      />
    );
  }

  if (roster.isPending) {
    return (
      <Text as="p" size="body" tone="muted">
        Loading your team…
      </Text>
    );
  }

  if (!roster.data) {
    return <EmptyState icon="users" title="Team unavailable" body="We couldn't load your team." />;
  }

  const { members, invites } = roster.data;

  function handleInvite(values: InviteMemberValues) {
    inviteMember.mutate(values, { onSuccess: () => setInviteOpen(false) });
  }

  function handleChangeRole(role: Role, grantAdmin: boolean) {
    if (!roleTarget) return;
    changeRole.mutate(
      { memberId: roleTarget.id, request: { role, grantAdmin } },
      { onSuccess: () => setRoleTarget(null) },
    );
  }

  function handleRemove() {
    if (!removeTarget) return;
    removeMember.mutate(removeTarget.id, { onSuccess: () => setRemoveTarget(null) });
  }

  function handleRevoke() {
    if (!revokeTarget) return;
    revokeInvite.mutate(revokeTarget.id, { onSuccess: () => setRevokeTarget(null) });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <Text as="h2" size="heading" tone="default">
            Team
          </Text>
          <Text as="p" size="label" tone="faint">
            {summary}
          </Text>
        </div>
        <span ref={inviteRef} className="inline-flex">
          <Button icon="plus" onClick={() => setInviteOpen(true)}>
            Invite teammate
          </Button>
        </span>
      </div>
      <GettingStartedSpotlight
        taskId="invite-team"
        anchorRef={inviteRef}
        title="Invite your team"
        body="Add teammates so they can submit expenses and get cards."
      />

      <div className="border-cl-border overflow-hidden rounded-xl border">
        {members.map((member) => (
          <div
            key={member.id}
            className="border-cl-border grid grid-cols-[1.5fr_1.9fr_1.4fr_0.8fr_1.4fr] items-center gap-2 border-b px-4 py-3 last:border-b-0"
          >
            <div className="flex items-center gap-2.5">
              <Avatar initials={initialsFromName(member.displayName)} size={30} />
              <Text as="span" size="label" weight="medium" tone="default">
                {member.displayName}
              </Text>
            </div>
            <Text as="span" size="mono" tone="muted" className="truncate">
              {member.email}
            </Text>
            <Text as="span" size="label" tone="default">
              {member.isOwner ? (
                <span className="text-cl-accent-text inline-flex items-center gap-1.5 font-semibold">
                  <Icon name="shield-check" size={14} />
                  Owner
                </span>
              ) : (
                <>
                  {roleLabel(member.role)}
                  {member.isAdmin ? <span className="text-cl-text-3"> · Admin</span> : null}
                </>
              )}
            </Text>
            <Text as="span" size="mono" tone="muted">
              {shortDate(member.joinedAt)}
            </Text>
            <div className="flex items-center justify-end gap-2">
              {member.isOwner ? (
                <span className="text-cl-text-3 inline-flex items-center gap-1.5 text-[11px]">
                  <Icon name="lock" size={12} />
                  Owner can’t be removed
                </span>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="pencil"
                    onClick={() => setRoleTarget(member)}
                  >
                    Change role
                  </Button>
                  {/* Icon-only action — the Button atom always renders a text span, so remove uses a
                      raw button (as the modals do for Cancel) to stay icon-only per Design §18.1. */}
                  <button
                    type="button"
                    aria-label={`Remove ${member.displayName}`}
                    title="Remove member"
                    onClick={() => setRemoveTarget(member)}
                    className="border-cl-border-2 text-cl-neg bg-cl-surface inline-flex cursor-pointer items-center rounded-lg border px-2 py-[7px]"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {invites.map((invite) => (
          <div
            key={invite.id}
            className="border-cl-border bg-cl-inset grid grid-cols-[1.5fr_1.9fr_1.4fr_0.8fr_1.4fr] items-center gap-2 border-b px-4 py-3 last:border-b-0"
          >
            <div className="flex items-center gap-2.5">
              <span className="border-cl-border-2 text-cl-text-3 flex h-[30px] w-[30px] items-center justify-center rounded-full border border-dashed">
                <Icon name="mail" size={14} />
              </span>
              <Text as="span" size="label" tone="faint" className="italic">
                Invitation sent
              </Text>
            </div>
            <Text as="span" size="mono" tone="muted" className="truncate">
              {invite.email}
            </Text>
            <Text as="span" size="label" tone="muted">
              {roleLabel(invite.role)}
              {invite.grantAdmin ? <span className="text-cl-text-3"> · Admin</span> : null}
            </Text>
            <div>
              <Chip label="Pending" icon="clock" />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon="refresh"
                onClick={() =>
                  resendInvite.mutate(invite.id, { onSuccess: () => setToast('Invite resent') })
                }
                // Scope the pending state to just this row so one resend doesn't disable the others.
                disabled={resendInvite.isPending && resendInvite.variables === invite.id}
              >
                Resend
              </Button>
              {/* Icon-only action — mirrors the member-remove control (Design §18.1). */}
              <button
                type="button"
                aria-label={`Revoke invite for ${invite.email}`}
                title="Revoke invite"
                onClick={() => setRevokeTarget(invite)}
                className="border-cl-border-2 text-cl-neg bg-cl-surface inline-flex cursor-pointer items-center rounded-lg border px-2 py-[7px]"
              >
                <Icon name="x-circle" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <InviteMemberModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSubmit={handleInvite}
        submitting={inviteMember.isPending}
      />

      {roleTarget ? (
        <ChangeRoleDialog
          open={roleTarget != null}
          onOpenChange={(open) => !open && setRoleTarget(null)}
          memberName={roleTarget.displayName}
          currentRole={roleTarget.role}
          currentIsAdmin={roleTarget.isAdmin}
          canRevokeAdmin={isOwner}
          onConfirm={handleChangeRole}
          submitting={changeRole.isPending}
        />
      ) : null}

      <ConfirmationDialog
        open={removeTarget != null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={removeTarget ? `Remove ${removeTarget.displayName}?` : 'Remove member?'}
        body="They'll be signed out on their next request and lose all access to this organization. To bring them back you'd have to re-invite them."
        confirmLabel="Remove member"
        countdown={0}
        onConfirm={handleRemove}
      />

      <ConfirmationDialog
        open={revokeTarget != null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title={revokeTarget ? `Revoke invite to ${revokeTarget.email}?` : 'Revoke invite?'}
        body="The invite link stops working immediately. If they still need access you'd have to send a fresh invite."
        confirmLabel="Revoke invite"
        countdown={0}
        onConfirm={handleRevoke}
      />

      <ToastViewport toast={toast} />
    </div>
  );
}
