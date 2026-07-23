import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { useInviteMember } from './use-invite-member';
import { useChangeMemberRole } from './use-change-member-role';
import { useRemoveMember } from './use-remove-member';
import { useResendInvite } from './use-resend-invite';
import { useRevokeInvite } from './use-revoke-invite';
import { useTransferOwnership } from './use-transfer-ownership';
import { TeamForbiddenError } from './team-forbidden-error';
import { TransferOwnershipError } from './transfer-ownership-error';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

afterEach(() => clearAccessToken());

describe('useInviteMember', () => {
  it('resolves on a 200 (enumeration-safe) invite', async () => {
    setAccessToken('access_valid');
    server.use(http.post('*/api/team/invites', () => HttpResponse.json({})));

    const { result } = renderHook(() => useInviteMember(), { wrapper });
    result.current.mutate({ email: 'x@y.test', role: 'employee', grantAdmin: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('surfaces a 403 as a typed TeamForbiddenError', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/team/invites', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );

    const { result } = renderHook(() => useInviteMember(), { wrapper });
    result.current.mutate({ email: 'x@y.test', role: 'employee', grantAdmin: false });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(TeamForbiddenError);
  });
});

describe('useChangeMemberRole', () => {
  it('resolves with the updated member', async () => {
    setAccessToken('access_valid');
    server.use(
      http.patch('*/api/team/members/:id/role', () =>
        HttpResponse.json({
          member: {
            id: 'user_2',
            displayName: 'Dara',
            email: 'd@x.test',
            role: 'controller',
            isAdmin: false,
            isOwner: false,
            joinedAt: '2026-05-01T00:00:00.000Z',
          },
        }),
      ),
    );

    const { result } = renderHook(() => useChangeMemberRole(), { wrapper });
    result.current.mutate({ memberId: 'user_2', request: { role: 'controller' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.member.role).toBe('controller');
  });
});

describe('useRemoveMember', () => {
  it('resolves on a 204 removal', async () => {
    setAccessToken('access_valid');
    server.use(
      http.delete('*/api/team/members/:id', () => new HttpResponse(null, { status: 204 })),
    );

    const { result } = renderHook(() => useRemoveMember(), { wrapper });
    result.current.mutate('user_2');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useResendInvite', () => {
  it('resolves on a 200 resend and posts to the invite’s /resend endpoint', async () => {
    setAccessToken('access_valid');
    let calledId: string | undefined;
    server.use(
      http.post('*/api/team/invites/:id/resend', ({ params }) => {
        calledId = String(params.id);
        return HttpResponse.json({});
      }),
    );

    const { result } = renderHook(() => useResendInvite(), { wrapper });
    result.current.mutate('invite_1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calledId).toBe('invite_1');
  });

  it('surfaces a 403 as a typed TeamForbiddenError', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/team/invites/:id/resend', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );

    const { result } = renderHook(() => useResendInvite(), { wrapper });
    result.current.mutate('invite_1');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(TeamForbiddenError);
  });
});

describe('useTransferOwnership (US-CW-043)', () => {
  it('resolves with the new + former Owner on success', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/team/owner-transfer', () =>
        HttpResponse.json({
          newOwner: {
            id: 'user_3',
            displayName: 'Sofia Whitman',
            email: 's@x.test',
            role: 'controller',
            isAdmin: true,
            isOwner: true,
            joinedAt: '2026-05-01T00:00:00.000Z',
          },
          formerOwner: {
            id: 'user_owner',
            displayName: 'Priya Nair',
            email: 'o@x.test',
            role: 'controller',
            isAdmin: true,
            isOwner: false,
            joinedAt: '2026-01-01T00:00:00.000Z',
          },
        }),
      ),
    );

    const { result } = renderHook(() => useTransferOwnership(), { wrapper });
    result.current.mutate({ newOwnerId: 'user_3', password: 'pw' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.newOwner.isOwner).toBe(true);
    expect(result.current.data?.formerOwner.isOwner).toBe(false);
  });

  it('maps a failed re-auth to a typed TransferOwnershipError naming the reason (AC-04/AC-07)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/team/owner-transfer', () =>
        HttpResponse.json({ error: 'reauth_failed' }, { status: 403 }),
      ),
    );

    const { result } = renderHook(() => useTransferOwnership(), { wrapper });
    result.current.mutate({ newOwnerId: 'user_3', password: 'wrong' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(TransferOwnershipError);
    expect((result.current.error as TransferOwnershipError).code).toBe('reauth_failed');
  });
});

describe('useRevokeInvite', () => {
  it('resolves on a 204 revoke and deletes the invite endpoint', async () => {
    setAccessToken('access_valid');
    let calledId: string | undefined;
    server.use(
      http.delete('*/api/team/invites/:id', ({ params }) => {
        calledId = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useRevokeInvite(), { wrapper });
    result.current.mutate('invite_1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calledId).toBe('invite_1');
  });
});
