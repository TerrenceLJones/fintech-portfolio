import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { SessionResponse } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { useAuthorization } from './use-authorization';
import { clearAccessToken, setAccessToken } from './access-token-store';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

function mockSession(overrides: Partial<SessionResponse>) {
  setAccessToken('access_valid');
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        userId: 'user_1',
        email: 'demo@clearline.dev',
        displayName: 'Marcus Okafor',
        role: 'employee',
        approvalLimit: null,
        currency: 'USD',
        isAdmin: false,
        isOwner: false,
        ...overrides,
      }),
    ),
  );
}

describe('useAuthorization', () => {
  it('maps an Employee session to only expenses/cards permissions', async () => {
    mockSession({ role: 'employee' });
    const { result } = renderHook(() => useAuthorization(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.role).toBe('employee');
    expect(result.current.can('expenses:view')).toBe(true);
    expect(result.current.can('approvals:view')).toBe(false);
  });

  it('maps a Finance Manager session to approval permissions with the limit', async () => {
    mockSession({ role: 'finance_manager', approvalLimit: 1_000_000 });
    const { result } = renderHook(() => useAuthorization(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.can('approvals:act')).toBe(true);
    expect(result.current.approvalLimit).toBe(1_000_000);
  });

  it('grants team:view for an Admin Employee without any approval authority', async () => {
    mockSession({ role: 'employee', isAdmin: true });
    const { result } = renderHook(() => useAuthorization(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.can('team:view')).toBe(true);
    expect(result.current.can('approvals:act')).toBe(false);
  });

  it('surfaces isOwner from the session and grants no permissions on its own (US-CW-030)', async () => {
    mockSession({ role: 'controller', isOwner: true });
    const { result } = renderHook(() => useAuthorization(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isOwner).toBe(true);
    // isOwner is orthogonal to permissions in this epic — a Controller Owner still has no team:view.
    expect(result.current.can('team:view')).toBe(false);
  });

  it('defaults isOwner to false while no session is loaded', () => {
    const { result } = renderHook(() => useAuthorization(), { wrapper });
    expect(result.current.isOwner).toBe(false);
  });

  it('surfaces the session displayName for the identity footer (US-CW-032)', async () => {
    mockSession({ displayName: 'Priya Nair' });
    const { result } = renderHook(() => useAuthorization(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.displayName).toBe('Priya Nair');
  });

  it('defaults displayName to null while no session is loaded', () => {
    const { result } = renderHook(() => useAuthorization(), { wrapper });
    expect(result.current.displayName).toBeNull();
  });

  it('surfaces the organization currency from the session (not assumed USD)', async () => {
    mockSession({ role: 'finance_manager', approvalLimit: 1_000_000, currency: 'EUR' });
    const { result } = renderHook(() => useAuthorization(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currency).toBe('EUR');
  });

  it('defaults currency to null while no session is loaded', () => {
    const { result } = renderHook(() => useAuthorization(), { wrapper });
    expect(result.current.currency).toBeNull();
  });
});
