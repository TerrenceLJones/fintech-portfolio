import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  CardProgramDefaultsResponse,
  IssuancePolicyResponse,
  UpdateCardProgramDefaultsRequest,
} from '@clearline/contracts';
import { CARD_PROGRAM_QUERY_KEY } from './card-program-query-keys';

async function getCardProgram(): Promise<CardProgramDefaultsResponse> {
  const response = await authenticatedFetch('/api/card-program');
  if (!response.ok) throw new Error('card_program_fetch_failed');
  return response.json();
}

/** Thrown when a card-program save is rejected (422) — carries the server's code for inline copy. */
export class CardProgramUpdateError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'CardProgramUpdateError';
  }
}

/** The org's card-program defaults: default limits, MCC restrictions, issuance policy (AC-01/02/03). */
export function useCardProgram() {
  return useQuery({
    queryKey: CARD_PROGRAM_QUERY_KEY,
    queryFn: getCardProgram,
    retry: false,
  });
}

async function patchCardProgram(
  request: UpdateCardProgramDefaultsRequest,
): Promise<CardProgramDefaultsResponse> {
  const response = await authenticatedFetch('/api/card-program', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new CardProgramUpdateError(payload.error ?? 'card_program_update_failed');
  }
  return response.json();
}

/** Persist card-program changes (AC-01/02/03), priming the cache with the server's canonical copy. */
export function useUpdateCardProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchCardProgram,
    onSuccess: (defaults) => queryClient.setQueryData(CARD_PROGRAM_QUERY_KEY, defaults),
  });
}

async function getIssuancePolicy(): Promise<IssuancePolicyResponse> {
  const response = await authenticatedFetch('/api/card-program/issuance-policy');
  if (!response.ok) throw new Error('issuance_policy_fetch_failed');
  return response.json();
}

/**
 * Whether the caller may request a card under the org's issuance policy (AC-03). Readable by any
 * authenticated user (unlike the manage-gated defaults), so the wallet can show or hide the "Request a
 * card" affordance; `canRequest` is decided server-side from the caller's own role.
 */
export function useIssuancePolicy(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...CARD_PROGRAM_QUERY_KEY, 'issuance-policy'] as const,
    queryFn: getIssuancePolicy,
    retry: false,
    enabled: options.enabled,
  });
}
