import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { useInviteMember } from './use-invite-member';
import { useChangeMemberRole } from './use-change-member-role';
import { useRemoveMember } from './use-remove-member';
import { TeamForbiddenError } from './team-forbidden-error';
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
