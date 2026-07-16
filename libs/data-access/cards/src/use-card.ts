import { useQuery } from '@tanstack/react-query';
import type { CardResponse } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { cardQueryKey } from './cards-query-key';

/** Thrown when a card id doesn't resolve (404) — the detail page renders a not-found state. */
export class CardNotFoundError extends Error {
  constructor() {
    super('card_not_found');
    this.name = 'CardNotFoundError';
  }
}

async function getCard(cardId: string): Promise<CardResponse> {
  const response = await authenticatedFetch(`/api/cards/${cardId}`);
  if (response.status === 404) throw new CardNotFoundError();
  if (!response.ok) throw new Error('card_failed');
  return response.json();
}

/** A single card's current state (US-CW-014). The derived remaining limit is computed from the returned money fields. */
export function useCard(cardId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: cardQueryKey(cardId),
    queryFn: () => getCard(cardId),
    retry: false,
    enabled: options.enabled,
  });
}
