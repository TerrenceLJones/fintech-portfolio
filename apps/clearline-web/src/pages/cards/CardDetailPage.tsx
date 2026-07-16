import { useMemo } from 'react';
import { useParams } from 'react-router';
import { toMajorUnits } from '@clearline/money';
import { EmptyState, Text, VirtualCard } from '@clearline/ui';
import { useAuthorization } from '@clearline/data-access-auth';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { usePageTitle } from '../../hooks/usePageTitle';
import { cardDetailBeacon } from './CardDetailPage.beacon';
import { useCardDetail } from './card-detail/use-card-detail';
import { DerivedLimitPanel } from './card-detail/DerivedLimitPanel';
import { FreezeControl } from './card-detail/FreezeControl';
import { TransactionFeed } from './card-detail/TransactionFeed';
import { DeclineNotice } from './card-detail/DeclineNotice';

/**
 * Card detail with the real-time transaction feed (US-CW-014). The left column shows the card, its
 * derived remaining limit, and (for a Controller) the freeze control; the right column streams the
 * live feed. A declined authorization surfaces a security-gated cardholder notice.
 */
export function CardDetailPage() {
  const { cardId = '' } = useParams();
  const detail = useCardDetail(cardId);
  const { can } = useAuthorization();
  const canManage = can('cards:manage');
  usePageTitle(detail.card ? detail.card.holderName : 'Card');
  // Memoize per card — cardDetailBeacon returns a fresh object each call, and useDemoBeacon
  // re-registers on config-identity change, so an inline call would loop the render (AC-01).
  useDemoBeacon(useMemo(() => cardDetailBeacon(cardId), [cardId]));

  if (detail.notFound) {
    return (
      <EmptyState
        icon="x-circle"
        title="Card not found"
        body="This card doesn’t exist or was removed."
      />
    );
  }
  if (detail.isLoading || !detail.card) {
    return (
      <Text as="p" size="label" tone="muted">
        Loading card…
      </Text>
    );
  }

  const card = detail.card;
  const frozen = card.status === 'frozen';
  const latest = detail.feed.transactions.at(-1);
  const latestDeclined = latest?.status === 'declined' ? latest : undefined;

  return (
    <div className="font-sans">
      <div className="border-cl-border bg-cl-bg overflow-hidden rounded-xl border md:flex">
        {/* ── Left: card, derived limit, freeze ───────────────────────────── */}
        <div className="border-cl-border flex flex-[0.85] flex-col gap-4 border-b p-5 md:border-r md:border-b-0">
          <VirtualCard
            holder={card.holderName}
            last4={card.last4}
            exp={card.exp}
            remaining={
              frozen
                ? undefined
                : toMajorUnits({
                    amountMinorUnits: detail.remainingMinorUnits,
                    currency: card.monthlyLimit.currency,
                  })
            }
            state={card.status}
          />
          <DerivedLimitPanel
            monthlyLimit={card.monthlyLimit}
            remainingMinorUnits={detail.remainingMinorUnits}
            allowedMccs={card.allowedMccs}
          />
          {canManage ? (
            <FreezeControl
              frozen={frozen}
              onToggle={detail.toggleFreeze}
              isBusy={detail.isFreezing}
            />
          ) : null}
        </div>

        {/* ── Right: live feed + any cardholder decline notice ────────────── */}
        <div className="flex flex-[1.15] flex-col gap-4 p-5">
          {latestDeclined ? <DeclineNotice transaction={latestDeclined} /> : null}
          <TransactionFeed feed={detail.feed} />
        </div>
      </div>
    </div>
  );
}
