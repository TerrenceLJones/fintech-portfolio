import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { ConnectedAccountsResponse } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import {
  ConnectedAccountActionError,
  ConnectedAccountsForbiddenError,
  useConnectManually,
  useConnectedAccounts,
} from './use-connected-accounts';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const ACCOUNTS: ConnectedAccountsResponse = {
  accounts: [
    {
      id: 'acct_chase',
      institutionName: 'Chase',
      last4: '8291',
      method: 'plaid',
      status: 'connected',
    },
  ],
};

describe('useConnectedAccounts (AC-04/09)', () => {
  it('loads the accounts', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/connected-accounts', () => HttpResponse.json(ACCOUNTS)));
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => useConnectedAccounts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.accounts).toHaveLength(1);
  });

  it('surfaces a 403 as ConnectedAccountsForbiddenError (AC-09)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/connected-accounts', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => useConnectedAccounts(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ConnectedAccountsForbiddenError);
  });
});

describe('useConnectManually (AC-05/06)', () => {
  it('raises a typed error carrying the server code on a 409 (already connected)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/connected-accounts/manual', () =>
        HttpResponse.json({ error: 'already_connected' }, { status: 409 }),
      ),
    );
    const { wrapper } = createQueryWrapper({
      queries: { retry: false },
      mutations: { retry: false },
    });
    const { result } = renderHook(() => useConnectManually(), { wrapper });
    result.current.mutate({ routingNumber: '021000021', accountNumber: '1234567890' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ConnectedAccountActionError);
    expect((result.current.error as ConnectedAccountActionError).code).toBe('already_connected');
  });
});
