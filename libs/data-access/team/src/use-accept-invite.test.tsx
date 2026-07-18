import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, getAccessToken } from '@clearline/data-access-auth';
import { useAcceptInvite } from './use-accept-invite';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

describe('useAcceptInvite', () => {
  it('stores the returned access token on a successful accept (auto-login)', async () => {
    server.use(
      http.post('*/api/team/invites/:token/accept', () =>
        HttpResponse.json({ outcome: 'success', accessToken: 'access_new' }),
      ),
    );

    const { result } = renderHook(() => useAcceptInvite(), { wrapper });
    result.current.mutate({ token: 'invite_ok', password: 'Correct-Horse-Battery-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.outcome).toBe('success');
    expect(getAccessToken()).toBe('access_new');
  });

  it('returns a non-success outcome as data without storing a token', async () => {
    server.use(
      http.post('*/api/team/invites/:token/accept', () =>
        HttpResponse.json({ outcome: 'invite_expired' }),
      ),
    );

    const { result } = renderHook(() => useAcceptInvite(), { wrapper });
    result.current.mutate({ token: 'invite_old', password: 'Correct-Horse-Battery-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.outcome).toBe('invite_expired');
    expect(getAccessToken()).toBeNull();
  });
});
