import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { TeamForbiddenError } from './team-forbidden-error';
import { useTeamRoster } from './use-team-roster';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

describe('useTeamRoster', () => {
  it('returns the roster on success', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/team/members', () =>
        HttpResponse.json({
          organizationId: 'org_1',
          organizationName: 'Northwind Labs, Inc.',
          members: [
            {
              id: 'user_owner',
              displayName: 'Priya Nair',
              email: 'p@n.test',
              role: 'controller',
              isAdmin: false,
              isOwner: true,
              joinedAt: '2026-04-01T00:00:00.000Z',
            },
          ],
          invites: [],
        }),
      ),
    );

    const { result } = renderHook(() => useTeamRoster(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.organizationName).toBe('Northwind Labs, Inc.');
    expect(result.current.data?.members[0]?.isOwner).toBe(true);
  });

  it('maps a 403 to a typed TeamForbiddenError (access-denied)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/team/members', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );

    const { result } = renderHook(() => useTeamRoster(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(TeamForbiddenError);
  });
});
