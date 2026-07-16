import { useQuery } from '@tanstack/react-query';
import type { CardListResponse } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { CARDS_QUERY_KEY } from './cards-query-key';

/** Thrown when the server rejects the wallet read with 403 — the redundant server check behind the route guard. */
export class CardsForbiddenError extends Error {
  constructor() {
    super('cards_forbidden');
    this.name = 'CardsForbiddenError';
  }
}

async function getCards(): Promise<CardListResponse> {
  const response = await authenticatedFetch('/api/cards');
  if (response.status === 403) throw new CardsForbiddenError();
  if (!response.ok) throw new Error('cards_failed');
  return response.json();
}

/**
 * The card wallet (US-CW-014). A server 403 surfaces as CardsForbiddenError so a mid-session downgrade
 * degrades to access-denied rather than a generic error, consistent with usePaymentContext.
 */
export function useCards(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: CARDS_QUERY_KEY,
    queryFn: getCards,
    retry: false,
    enabled: options.enabled,
  });
}
