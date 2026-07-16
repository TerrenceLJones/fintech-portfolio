import type { VirtualCard } from '@clearline/contracts';
import { deriveRemainingLimit } from '@clearline/domain-cards';
import { toMajorUnits } from '@clearline/money';
import { StatusBadge, Text, VirtualCard as VirtualCardFace, formatMoneyValue } from '@clearline/ui';

export interface CardTileProps {
  card: VirtualCard;
  onOpen: (cardId: string) => void;
}

/**
 * One wallet tile: the card face plus a footer row showing the DERIVED remaining limit and a status
 * badge (icon + text, never colour alone — US-CW-014). The whole tile opens the card's detail feed.
 */
export function CardTile({ card, onOpen }: CardTileProps) {
  const frozen = card.status === 'frozen';
  const remainingMinor = deriveRemainingLimit(
    card.monthlyLimit.amountMinorUnits,
    card.authorizedSpend.amountMinorUnits,
  );
  const remaining = { amountMinorUnits: remainingMinor, currency: card.monthlyLimit.currency };

  return (
    <button
      type="button"
      data-card-tile
      onClick={() => onOpen(card.id)}
      className="border-cl-border bg-cl-surface hover:border-cl-border-2 focus-visible:outline-cl-focus block w-full rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-2"
    >
      <VirtualCardFace
        holder={card.holderName}
        last4={card.last4}
        exp={card.exp}
        remaining={frozen ? undefined : toMajorUnits(remaining)}
        state={card.status}
      />
      <div className="mt-3 flex items-center justify-between">
        <div>
          <Text as="div" size="label" tone="faint">
            Remaining
          </Text>
          <Text as="div" size="mono" weight="semibold" tone="default">
            {formatMoneyValue(remaining)}
          </Text>
        </div>
        <StatusBadge status={frozen ? 'frozen' : 'active'} />
      </div>
    </button>
  );
}
