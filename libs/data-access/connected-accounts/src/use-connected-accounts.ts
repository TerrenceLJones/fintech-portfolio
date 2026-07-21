import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  ConnectManuallyRequest,
  ConnectedAccountResponse,
  ConnectedAccountsResponse,
  VerifyMicroDepositsResponse,
} from '@clearline/contracts';
import { CONNECTED_ACCOUNTS_QUERY_KEY } from './connected-accounts-query-keys';

/** Thrown when the caller lacks bank-accounts:manage — the page degrades to AccessDenied (AC-09). */
export class ConnectedAccountsForbiddenError extends Error {
  constructor() {
    super('connected_accounts_forbidden');
    this.name = 'ConnectedAccountsForbiddenError';
  }
}

async function getConnectedAccounts(): Promise<ConnectedAccountsResponse> {
  const response = await authenticatedFetch('/api/connected-accounts');
  if (response.status === 403) throw new ConnectedAccountsForbiddenError();
  if (!response.ok) throw new Error('connected_accounts_fetch_failed');
  return response.json();
}

/** The org's connected bank accounts, with their connection status (AC-04–08). */
export function useConnectedAccounts() {
  return useQuery({
    queryKey: CONNECTED_ACCOUNTS_QUERY_KEY,
    queryFn: getConnectedAccounts,
    retry: false,
  });
}

/**
 * An error raised by a connect/verify mutation that carries the server's typed error code, so the UI
 * can show the specific inline copy (e.g. "already connected", "those amounts don't match").
 */
export class ConnectedAccountActionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'ConnectedAccountActionError';
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const response = await authenticatedFetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ConnectedAccountActionError(payload.error ?? 'request_failed', response.status);
  }
  return response.json() as Promise<T>;
}

function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: CONNECTED_ACCOUNTS_QUERY_KEY });
}

/** Connect a verified account via the (mocked) Plaid Link flow (AC-04). */
export function useConnectViaPlaid() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: () => post<ConnectedAccountResponse>('/api/connected-accounts/plaid'),
    onSuccess: invalidate,
  });
}

/** Begin a manual connection; the account starts pending micro-deposit verification (AC-05). */
export function useConnectManually() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (request: ConnectManuallyRequest) =>
      post<ConnectedAccountResponse>('/api/connected-accounts/manual', request),
    onSuccess: invalidate,
  });
}

/** Submit the two micro-deposit amounts to verify a pending manual account (AC-05/06). */
export function useVerifyMicroDeposits() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: { id: string; amountsMinorUnits: [number, number] }) =>
      post<VerifyMicroDepositsResponse>(`/api/connected-accounts/${input.id}/verify`, {
        amountsMinorUnits: input.amountsMinorUnits,
      }),
    onSuccess: invalidate,
  });
}

/** Recover a Plaid account from reconnect_required after re-authentication (AC-08). */
export function useReconnectAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (id: string) =>
      post<ConnectedAccountResponse>(`/api/connected-accounts/${id}/reconnect`),
    onSuccess: invalidate,
  });
}

/** Remove an account — future transfers are blocked, in-flight payments are untouched (AC-07). */
export function useRemoveAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await authenticatedFetch(`/api/connected-accounts/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('connected_account_remove_failed');
      return response.json() as Promise<ConnectedAccountResponse>;
    },
    onSuccess: invalidate,
  });
}
