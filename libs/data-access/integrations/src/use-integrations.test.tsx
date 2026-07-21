import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { IntegrationsResponse, SyncResult } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import {
  IntegrationActionError,
  IntegrationsForbiddenError,
  useIntegrations,
  useSyncNow,
} from './use-integrations';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const INTEGRATIONS: IntegrationsResponse = {
  integrations: [{ provider: 'quickbooks', name: 'QuickBooks Online', status: 'connected' }],
};

describe('useIntegrations (AC-01/09)', () => {
  it('loads the integrations', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/integrations', () => HttpResponse.json(INTEGRATIONS)));
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => useIntegrations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.integrations).toHaveLength(1);
  });

  it('surfaces a 403 as IntegrationsForbiddenError (AC-09)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/integrations', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => useIntegrations(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(IntegrationsForbiddenError);
  });
});

describe('useSyncNow (AC-03)', () => {
  it('returns the sync result on success', async () => {
    setAccessToken('access_valid');
    const RESULT: SyncResult = {
      integration: { provider: 'quickbooks', name: 'QuickBooks Online', status: 'connected' },
      recordsSynced: 47,
      outcome: 'success',
    };
    server.use(http.post('*/api/integrations/quickbooks/sync', () => HttpResponse.json(RESULT)));
    const { wrapper } = createQueryWrapper({
      queries: { retry: false },
      mutations: { retry: false },
    });
    const { result } = renderHook(() => useSyncNow(), { wrapper });
    result.current.mutate('quickbooks');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.recordsSynced).toBe(47);
  });

  it('raises a typed error carrying the server code on a 409', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/integrations/xero/sync', () =>
        HttpResponse.json({ error: 'not_connected' }, { status: 409 }),
      ),
    );
    const { wrapper } = createQueryWrapper({
      queries: { retry: false },
      mutations: { retry: false },
    });
    const { result } = renderHook(() => useSyncNow(), { wrapper });
    result.current.mutate('xero');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as IntegrationActionError).code).toBe('not_connected');
  });
});
