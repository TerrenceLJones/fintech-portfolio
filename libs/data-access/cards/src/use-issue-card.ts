import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CardErrorCode, CardResponse, IssueCardRequest } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { CARDS_QUERY_KEY } from './cards-query-key';

/**
 * A server-side rejection of a card issuance the client maps to inline copy — a bad limit or holder, or
 * a permission block. Distinct from a transient failure so the form shows specific guidance and never
 * silently retries a decision the server has already made.
 */
export class CardIssueError extends Error {
  readonly code: CardErrorCode;
  constructor(code: CardErrorCode) {
    super(`card_issue_rejected: ${code}`);
    this.name = 'CardIssueError';
    this.code = code;
  }
}

async function postIssueCard(request: IssueCardRequest): Promise<CardResponse> {
  const response = await authenticatedFetch('/api/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (response.status === 403) throw new CardIssueError('forbidden');
  if (response.status === 422) {
    const body = (await response.json()) as { error: CardErrorCode };
    throw new CardIssueError(body.error);
  }
  if (!response.ok) throw new Error('card_issue_failed');
  return response.json();
}

/**
 * Issues a virtual card (US-CW-014 AC-01). On success the wallet is refetched so the newly issued card
 * appears without a manual reload.
 */
export function useIssueCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postIssueCard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY }),
  });
}
