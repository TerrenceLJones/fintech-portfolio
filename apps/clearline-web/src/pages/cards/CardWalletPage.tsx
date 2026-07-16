import { useNavigate } from 'react-router';
import { AccessDenied, Button, EmptyState, Text } from '@clearline/ui';
import { useCards, CardsForbiddenError } from '@clearline/data-access-cards';
import { useAuthorization } from '@clearline/data-access-auth';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { usePageTitle } from '../../hooks/usePageTitle';
import { cardWalletBeacon } from './CardWalletPage.beacon';
import { CardTile } from './card-wallet/CardTile';

/**
 * The card wallet (US-CW-014). Every role can view it (cards:view); only a Controller (cards:manage)
 * sees the "+ Issue card" entry point. Each card shows a derived remaining limit and an icon+text
 * status badge, and opens its live transaction feed.
 */
export function CardWalletPage() {
  usePageTitle('My Cards');
  useDemoBeacon(cardWalletBeacon);
  const navigate = useNavigate();
  const { can } = useAuthorization();
  const canManage = can('cards:manage');
  const query = useCards();

  if (query.error instanceof CardsForbiddenError) {
    return <AccessDenied requestLine="403 Forbidden · GET /api/cards" />;
  }

  const cards = query.data?.cards ?? [];
  const activeCount = cards.filter((c) => c.status === 'active').length;
  const frozenCount = cards.filter((c) => c.status === 'frozen').length;

  return (
    <div className="font-sans">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Text as="p" size="label" tone="muted" className="mb-0">
            Virtual cards, live controls
          </Text>
          {cards.length > 0 ? (
            <Text as="p" size="label" tone="faint" className="mt-0.5 mb-0">
              {activeCount} active &middot; {frozenCount} frozen
            </Text>
          ) : null}
        </div>
        {canManage ? (
          <Button icon="plus" onClick={() => navigate('/cards/new')}>
            Issue card
          </Button>
        ) : null}
      </div>

      {query.isPending ? (
        <Text as="p" size="label" tone="muted">
          Loading cards…
        </Text>
      ) : cards.length === 0 ? (
        <EmptyState
          icon="copy"
          title="No cards yet"
          body={
            canManage
              ? 'Issue your first virtual card to set spend limits and merchant restrictions.'
              : 'Cards issued to you will appear here.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <CardTile key={card.id} card={card} onOpen={(id) => navigate(`/cards/${id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
