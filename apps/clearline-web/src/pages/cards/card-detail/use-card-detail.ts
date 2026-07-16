import { useEffect, useRef } from 'react';
import type { VirtualCard } from '@clearline/contracts';
import {
  useCard,
  useFreezeCard,
  useTransactionFeed,
  CardNotFoundError,
  type TransactionFeedState,
} from '@clearline/data-access-cards';
import { deriveRemainingLimit } from '@clearline/domain-cards';

export interface CardDetailView {
  card: VirtualCard | undefined;
  isLoading: boolean;
  notFound: boolean;
  /** Derived remaining limit in minor units (monthly limit − authorized spend). */
  remainingMinorUnits: number;
  feed: TransactionFeedState;
  toggleFreeze: () => void;
  isFreezing: boolean;
}

/**
 * Orchestrates the card detail view (US-CW-014): the card record, its live transaction feed, and the
 * freeze control. When an approved authorization streams in, the card is refetched so its derived
 * remaining limit moves to reflect the new authorized spend — server truth, never a client-side tally
 * (AC-02). Freezing/unfreezing flips the card's state at the authorization layer immediately (AC-05).
 */
export function useCardDetail(cardId: string): CardDetailView {
  const cardQuery = useCard(cardId);
  const feed = useTransactionFeed(cardId);
  const freeze = useFreezeCard();

  const card = cardQuery.data?.card;
  const remainingMinorUnits = card
    ? deriveRemainingLimit(
        card.monthlyLimit.amountMinorUnits,
        card.authorizedSpend.amountMinorUnits,
      )
    : 0;

  // Re-pull the card whenever a new APPROVED authorization streams in, so the derived remaining limit
  // reflects the server's updated authorized spend rather than a client-side guess.
  const lastSeenTxnId = useRef<string | undefined>(undefined);
  const refetchCard = cardQuery.refetch;
  useEffect(() => {
    const latest = feed.transactions.at(-1);
    if (!latest || latest.id === lastSeenTxnId.current) return;
    lastSeenTxnId.current = latest.id;
    if (latest.status === 'approved') void refetchCard();
  }, [feed.transactions, refetchCard]);

  const toggleFreeze = () => {
    if (!card) return;
    freeze.mutate({ cardId, frozen: card.status !== 'frozen' });
  };

  return {
    card,
    isLoading: cardQuery.isPending,
    notFound: cardQuery.error instanceof CardNotFoundError,
    remainingMinorUnits,
    feed,
    toggleFreeze,
    isFreezing: freeze.isPending,
  };
}
