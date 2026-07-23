import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  CreateWebhookRequest,
  CreateWebhookResponse,
  DeveloperResponse,
} from '@clearline/contracts';
import { DEVELOPER_QUERY_KEY } from './developer-query-keys';

/** Thrown when the caller lacks developer:manage — the page degrades to AccessDenied (AC-10). */
export class DeveloperForbiddenError extends Error {
  constructor() {
    super('developer_forbidden');
    this.name = 'DeveloperForbiddenError';
  }
}

/** Carries the server's typed error code + status so a form can show the specific inline copy. */
export class DeveloperActionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    /** The specific thing the error names, e.g. the offending URL for a non-HTTPS webhook (AC-07). */
    public readonly detail?: string,
  ) {
    super(code);
    this.name = 'DeveloperActionError';
  }
}

async function getDeveloper(): Promise<DeveloperResponse> {
  const response = await authenticatedFetch('/api/developer');
  if (response.status === 403) throw new DeveloperForbiddenError();
  if (!response.ok) throw new Error('developer_fetch_failed');
  return response.json();
}

/** The org's API keys and webhooks for the Developer settings page (AC-01–09). */
export function useDeveloper() {
  return useQuery({
    queryKey: DEVELOPER_QUERY_KEY,
    queryFn: getDeveloper,
    retry: false,
  });
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await authenticatedFetch(path, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
    };
    throw new DeveloperActionError(
      payload.error ?? 'request_failed',
      response.status,
      payload.detail,
    );
  }
  return response.json() as Promise<T>;
}

function useInvalidateDeveloper() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: DEVELOPER_QUERY_KEY });
}

/**
 * Create a scoped API key (AC-01). Does NOT invalidate on its own — the caller first shows the
 * reveal-once modal with the returned plaintext, then invalidates on dismissal so the new (masked) key
 * appears in the list.
 */
export function useCreateApiKey() {
  return useMutation({
    mutationFn: (input: CreateApiKeyRequest) =>
      send<CreateApiKeyResponse>('/api/developer/api-keys', 'POST', input),
  });
}

/** Revoke a key immediately and permanently (AC-04). */
export function useRevokeApiKey() {
  const invalidate = useInvalidateDeveloper();
  return useMutation({
    mutationFn: (keyId: string) =>
      send<DeveloperResponse>(`/api/developer/api-keys/${keyId}`, 'DELETE'),
    onSuccess: invalidate,
  });
}

/**
 * Register an HTTPS webhook endpoint (AC-06). Like key creation, does not invalidate itself — the
 * caller reveals the signing secret once, then invalidates on dismissal.
 */
export function useCreateWebhook() {
  return useMutation({
    mutationFn: (input: CreateWebhookRequest) =>
      send<CreateWebhookResponse>('/api/developer/webhooks', 'POST', input),
  });
}

/** Delete a webhook endpoint (AC-06). */
export function useDeleteWebhook() {
  const invalidate = useInvalidateDeveloper();
  return useMutation({
    mutationFn: (webhookId: string) =>
      send<DeveloperResponse>(`/api/developer/webhooks/${webhookId}`, 'DELETE'),
    onSuccess: invalidate,
  });
}

/** Re-send a failed delivery (AC-09) — a new log entry is appended and the list refreshes. */
export function useResendDelivery() {
  const invalidate = useInvalidateDeveloper();
  return useMutation({
    mutationFn: (input: { webhookId: string; deliveryId: string }) =>
      send<DeveloperResponse>(
        `/api/developer/webhooks/${input.webhookId}/deliveries/${input.deliveryId}/resend`,
        'POST',
      ),
    onSuccess: invalidate,
  });
}
