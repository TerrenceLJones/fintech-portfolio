import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { ProfileResponse } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import { useProfile, useUpdateProfile } from './use-profile';
import { useUpdateAvatar } from './use-avatar';
import { RequestEmailChangeError, useRequestEmailChange } from './use-email-change';
import { SESSION_QUERY_KEY } from './profile-query-keys';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const PROFILE: ProfileResponse = {
  userId: 'user_1',
  displayName: 'Demo User',
  email: 'demo@clearline.dev',
  phone: null,
  jobTitle: null,
  avatarUrl: null,
  pendingEmail: null,
};

describe('useProfile / useUpdateProfile (AC-01)', () => {
  it('loads the profile then persists an edit', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/profile', () => HttpResponse.json(PROFILE)),
      http.patch('*/api/profile', async ({ request }) => {
        const patch = (await request.json()) as Partial<ProfileResponse>;
        return HttpResponse.json({ ...PROFILE, ...patch });
      }),
    );
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => ({ profile: useProfile(), update: useUpdateProfile() }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.profile.isSuccess).toBe(true));
    expect(result.current.profile.data?.email).toBe('demo@clearline.dev');

    result.current.update.mutate({ displayName: 'Marcus O.', phone: '+1 555', jobTitle: 'CFO' });
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(result.current.update.data?.displayName).toBe('Marcus O.');
  });
});

describe('useUpdateAvatar (AC-05)', () => {
  it('invalidates the session query so the sidebar avatar re-reads', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/profile/avatar', async ({ request }) => {
        const { avatarUrl } = (await request.json()) as { avatarUrl: string };
        return HttpResponse.json({ ...PROFILE, avatarUrl });
      }),
    );
    const { wrapper, queryClient } = createQueryWrapper({ queries: { retry: false } });
    queryClient.setQueryData(SESSION_QUERY_KEY, { avatarUrl: null });
    const { result } = renderHook(() => useUpdateAvatar(), { wrapper });

    result.current.mutate('data:image/png;base64,AAAA');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(SESSION_QUERY_KEY)?.isInvalidated).toBe(true);
  });
});

describe('useRequestEmailChange (AC-03)', () => {
  it('maps a 422 to a typed RequestEmailChangeError with the server code', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/profile/email-change', () =>
        HttpResponse.json({ error: 'same_as_current' }, { status: 422 }),
      ),
    );
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => useRequestEmailChange(), { wrapper });

    result.current.mutate('demo@clearline.dev');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(RequestEmailChangeError);
    expect((result.current.error as RequestEmailChangeError).code).toBe('same_as_current');
  });
});
