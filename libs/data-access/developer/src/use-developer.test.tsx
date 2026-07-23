import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { CreateApiKeyResponse, DeveloperResponse } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import {
  DeveloperActionError,
  DeveloperForbiddenError,
  useCreateApiKey,
  useCreateWebhook,
  useDeleteWebhook,
  useDeveloper,
  useResendDelivery,
  useRevokeApiKey,
} from './use-developer';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const EMPTY: DeveloperResponse = { apiKeys: [], webhooks: [] };

describe('useDeveloper (AC-01/10)', () => {
  it('loads the developer surface', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/developer', () => HttpResponse.json(EMPTY)));
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => useDeveloper(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.apiKeys).toEqual([]);
  });

  it('surfaces a 403 as DeveloperForbiddenError (AC-10)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/developer', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => useDeveloper(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(DeveloperForbiddenError);
  });
});

describe('useCreateApiKey (AC-01)', () => {
  it('returns the reveal-once plaintext', async () => {
    setAccessToken('access_valid');
    const response: CreateApiKeyResponse = {
      key: {
        id: 'apikey_1',
        name: 'Prod',
        maskedKey: 'sk_live_••••••••••••••ab3f',
        scopes: ['read:transactions'],
        createdAt: '2026-07-22T00:00:00.000Z',
        lastUsedAt: null,
      },
      plaintextKey: 'sk_live_realsecretab3f',
    };
    server.use(
      http.post('*/api/developer/api-keys', () => HttpResponse.json(response, { status: 201 })),
    );
    const { wrapper } = createQueryWrapper({ mutations: { retry: false } });
    const { result } = renderHook(() => useCreateApiKey(), { wrapper });
    result.current.mutate({ name: 'Prod', scopes: ['read:transactions'] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.plaintextKey).toBe('sk_live_realsecretab3f');
  });
});

describe('useRevokeApiKey (AC-04)', () => {
  it('sends a bodyless DELETE and returns the refreshed list', async () => {
    setAccessToken('access_valid');
    let method = '';
    server.use(
      http.delete('*/api/developer/api-keys/apikey_1', ({ request }) => {
        method = request.method;
        return HttpResponse.json(EMPTY);
      }),
    );
    const { wrapper } = createQueryWrapper({ mutations: { retry: false } });
    const { result } = renderHook(() => useRevokeApiKey(), { wrapper });
    result.current.mutate('apikey_1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(method).toBe('DELETE');
    expect(result.current.data?.apiKeys).toEqual([]);
  });
});

describe('useDeleteWebhook + useResendDelivery (AC-06/09)', () => {
  it('deletes a webhook via DELETE', async () => {
    setAccessToken('access_valid');
    server.use(http.delete('*/api/developer/webhooks/webhook_1', () => HttpResponse.json(EMPTY)));
    const { wrapper } = createQueryWrapper({ mutations: { retry: false } });
    const { result } = renderHook(() => useDeleteWebhook(), { wrapper });
    result.current.mutate('webhook_1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('resends a delivery via POST to the resend path', async () => {
    setAccessToken('access_valid');
    let path = '';
    server.use(
      http.post('*/api/developer/webhooks/:id/deliveries/:deliveryId/resend', ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json(EMPTY);
      }),
    );
    const { wrapper } = createQueryWrapper({ mutations: { retry: false } });
    const { result } = renderHook(() => useResendDelivery(), { wrapper });
    result.current.mutate({ webhookId: 'webhook_1', deliveryId: 'whd_1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(path).toBe('/api/developer/webhooks/webhook_1/deliveries/whd_1/resend');
  });
});

describe('useCreateWebhook (AC-07)', () => {
  it('surfaces a non-HTTPS rejection with the offending URL detail', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/developer/webhooks', () =>
        HttpResponse.json(
          { error: 'invalid_url', detail: 'http://x.example.com' },
          { status: 422 },
        ),
      ),
    );
    const { wrapper } = createQueryWrapper({ mutations: { retry: false } });
    const { result } = renderHook(() => useCreateWebhook(), { wrapper });
    result.current.mutate({ url: 'http://x.example.com', events: ['transfer.completed'] });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as DeveloperActionError;
    expect(error).toBeInstanceOf(DeveloperActionError);
    expect(error.code).toBe('invalid_url');
    expect(error.detail).toBe('http://x.example.com');
  });
});
