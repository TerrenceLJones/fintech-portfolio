import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CardErrorCode, CardResponse } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { CARDS_QUERY_KEY, cardQueryKey } from './cards-query-key';

/** A server-side rejection of a freeze/unfreeze (permission block or unknown card). */
export class CardFreezeError extends Error {
  readonly code: CardErrorCode;
  constructor(code: CardErrorCode) {
    super(`card_freeze_rejected: ${code}`);
    this.name = 'CardFreezeError';
    this.code = code;
  }
}

export interface FreezeCardVariables {
  cardId: string;
  frozen: boolean;
}

async function postFreeze({ cardId, frozen }: FreezeCardVariables): Promise<CardResponse> {
  const response = await authenticatedFetch(`/api/cards/${cardId}/freeze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ frozen }),
  });
  if (response.status === 403) throw new CardFreezeError('forbidden');
  if (response.status === 404) throw new CardFreezeError('card_not_found');
  if (!response.ok) throw new Error('card_freeze_failed');
  return response.json();
}

/**
 * Freezes or unfreezes a card (US-CW-014 AC-05). The change takes effect server-side immediately; on
 * success both the wallet and the single-card cache are invalidated so every surface reflects the new
 * frozen state at once.
 */
export function useFreezeCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postFreeze,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: cardQueryKey(data.card.id) });
    },
  });
}
