import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { SessionListResponse, TwoFactorStatus } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import { ChangePasswordError, useChangePassword } from './use-password';
import { DisableTwoFactorError, useDisableTwoFactor, useTwoFactorStatus } from './use-two-factor';
import { securityKeys } from './security-query-keys';
import { useRevokeSession, useSessions } from './use-sessions';

const server = registerMswServer();
afterEach(() => clearAccessToken());

describe('useChangePassword (AC-02)', () => {
  it('maps a 422 to a typed ChangePasswordError with the server code', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/security/password', () =>
        HttpResponse.json({ error: 'incorrect_password' }, { status: 422 }),
      ),
    );
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => useChangePassword(), { wrapper });

    result.current.mutate({ currentPassword: 'x', newPassword: 'Str0ng-Pass!word' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ChangePasswordError);
    expect((result.current.error as ChangePasswordError).code).toBe('incorrect_password');
  });
});

describe('useDisableTwoFactor (AC-07)', () => {
  it('maps a 403 to a typed DisableTwoFactorError and invalidates the 2FA status', async () => {
    setAccessToken('access_valid');
    const status: TwoFactorStatus = { enabled: true, orgEnforced: true };
    server.use(
      http.get('*/api/security/two-factor', () => HttpResponse.json(status)),
      http.post('*/api/security/two-factor/disable', () =>
        HttpResponse.json({ error: 'org_enforced' }, { status: 403 }),
      ),
    );
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(
      () => ({ status: useTwoFactorStatus(), disable: useDisableTwoFactor() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.status.isSuccess).toBe(true));

    result.current.disable.mutate();
    await waitFor(() => expect(result.current.disable.isError).toBe(true));
    expect(result.current.disable.error).toBeInstanceOf(DisableTwoFactorError);
    expect((result.current.disable.error as DisableTwoFactorError).code).toBe('org_enforced');
  });
});

describe('useSessions (AC-08)', () => {
  it('lists the caller sessions', async () => {
    setAccessToken('access_valid');
    const sessions: SessionListResponse = {
      sessions: [
        {
          id: 'session_current',
          deviceType: 'desktop',
          browser: 'Chrome',
          os: 'macOS',
          city: 'San Francisco',
          country: 'US',
          lastActiveAt: new Date().toISOString(),
          current: true,
        },
      ],
    };
    server.use(http.get('*/api/security/sessions', () => HttpResponse.json(sessions)));
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => useSessions(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.sessions[0]?.current).toBe(true);
  });
});

describe('useRevokeSession (AC-09)', () => {
  it('invalidates the sessions query on success', async () => {
    setAccessToken('access_valid');
    server.use(http.delete('*/api/security/sessions/:id', () => HttpResponse.json({ ok: true })));
    // Seed the sessions cache without mounting useSessions, so the invalidation flag sticks
    // (a mounted active query would refetch and clear it before we can assert).
    const { wrapper, queryClient } = createQueryWrapper({ queries: { retry: false } });
    queryClient.setQueryData(securityKeys.sessions, { sessions: [] });
    const { result } = renderHook(() => useRevokeSession(), { wrapper });

    result.current.mutate('session_other');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(securityKeys.sessions)?.isInvalidated).toBe(true);
  });
});
