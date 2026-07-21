import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  GlMappingResponse,
  IntegrationProvider,
  IntegrationResponse,
  IntegrationsResponse,
  SyncLogResponse,
  SyncResult,
  UpdateGlMappingRequest,
} from '@clearline/contracts';
import {
  INTEGRATIONS_QUERY_KEY,
  glMappingQueryKey,
  syncLogQueryKey,
} from './integrations-query-keys';

/** Thrown when the caller lacks integrations:manage — the page degrades to AccessDenied (AC-09). */
export class IntegrationsForbiddenError extends Error {
  constructor() {
    super('integrations_forbidden');
    this.name = 'IntegrationsForbiddenError';
  }
}

/** Carries the server's typed error code so a dialog can show the specific inline copy. */
export class IntegrationActionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'IntegrationActionError';
  }
}

async function getIntegrations(): Promise<IntegrationsResponse> {
  const response = await authenticatedFetch('/api/integrations');
  if (response.status === 403) throw new IntegrationsForbiddenError();
  if (!response.ok) throw new Error('integrations_fetch_failed');
  return response.json();
}

/** The org's accounting integrations with their connection status (AC-01/04). */
export function useIntegrations() {
  return useQuery({
    queryKey: INTEGRATIONS_QUERY_KEY,
    queryFn: getIntegrations,
    retry: false,
  });
}

/** The GL mapping table for a provider — categories + the provider chart of accounts (AC-02). */
export function useGlMapping(provider: IntegrationProvider, enabled = true) {
  return useQuery({
    queryKey: glMappingQueryKey(provider),
    queryFn: async (): Promise<GlMappingResponse> => {
      const response = await authenticatedFetch(`/api/integrations/${provider}/gl-mapping`);
      if (response.status === 403) throw new IntegrationsForbiddenError();
      if (!response.ok) throw new Error('gl_mapping_fetch_failed');
      return response.json();
    },
    enabled,
    retry: false,
  });
}

/** The provider's sync-log history (AC-05). Only fetched when the log is open. */
export function useSyncLog(provider: IntegrationProvider, enabled = true) {
  return useQuery({
    queryKey: syncLogQueryKey(provider),
    queryFn: async (): Promise<SyncLogResponse> => {
      const response = await authenticatedFetch(`/api/integrations/${provider}/sync-log`);
      if (response.status === 403) throw new IntegrationsForbiddenError();
      if (!response.ok) throw new Error('sync_log_fetch_failed');
      return response.json();
    },
    enabled,
    retry: false,
  });
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const response = await authenticatedFetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new IntegrationActionError(payload.error ?? 'request_failed', response.status);
  }
  return response.json() as Promise<T>;
}

function useInvalidateIntegrations() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: INTEGRATIONS_QUERY_KEY });
}

/** Complete a (mocked) OAuth authorization for a provider — it lands Connected (AC-01). */
export function useConnectIntegration() {
  const invalidate = useInvalidateIntegrations();
  return useMutation({
    mutationFn: (provider: IntegrationProvider) =>
      post<IntegrationResponse>(`/api/integrations/${provider}/connect`),
    onSuccess: invalidate,
  });
}

/** Save a provider's category → GL-account mapping (AC-02). */
export function useUpdateGlMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      provider: IntegrationProvider;
      mappings: UpdateGlMappingRequest['mappings'];
    }) =>
      authenticatedFetch(`/api/integrations/${input.provider}/gl-mapping`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mappings: input.mappings }),
      }).then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new IntegrationActionError(payload.error ?? 'request_failed', response.status);
        }
        return response.json() as Promise<IntegrationResponse>;
      }),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: glMappingQueryKey(input.provider) });
      void queryClient.invalidateQueries({ queryKey: INTEGRATIONS_QUERY_KEY });
    },
  });
}

/** Run a sync for a provider (AC-03); the client toasts the returned record count. */
export function useSyncNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: IntegrationProvider) =>
      post<SyncResult>(`/api/integrations/${provider}/sync`),
    onSuccess: (_data, provider) => {
      void queryClient.invalidateQueries({ queryKey: INTEGRATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: syncLogQueryKey(provider) });
    },
  });
}

/** Reconnect a provider from an error state (AC-04). */
export function useReconnectIntegration() {
  const invalidate = useInvalidateIntegrations();
  return useMutation({
    mutationFn: (provider: IntegrationProvider) =>
      post<IntegrationResponse>(`/api/integrations/${provider}/reconnect`),
    onSuccess: invalidate,
  });
}

/** Disconnect a provider — auto-sync stops, GL mappings are preserved (AC-06). */
export function useDisconnectIntegration() {
  const invalidate = useInvalidateIntegrations();
  return useMutation({
    mutationFn: (provider: IntegrationProvider) =>
      post<IntegrationResponse>(`/api/integrations/${provider}/disconnect`),
    onSuccess: invalidate,
  });
}
