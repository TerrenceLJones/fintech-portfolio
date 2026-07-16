import type { CardTransaction } from '@clearline/contracts';
import { feedDeclineLabel } from '@clearline/domain-cards';
import { toMajorUnits } from '@clearline/money';
import { Alert, Text, TransactionRow } from '@clearline/ui';
import type { TransactionFeedState } from '@clearline/data-access-cards';
import { relativeTime } from './relative-time';

export interface TransactionFeedProps {
  feed: TransactionFeedState;
}

/**
 * The card's real-time transaction feed (US-CW-014 AC-02/AC-03/AC-04/AC-06). Newest first; the most
 * recent approved row is highlighted as freshly-streamed. A declined row names its reason and strikes
 * through the amount. While reconnecting, a "Reconnecting…" banner shows with the backoff countdown,
 * the prior rows are dimmed (stale, not gone), and a footer states they may not be current.
 */
export function TransactionFeed({ feed }: TransactionFeedProps) {
  const reconnecting = feed.connectionState === 'reconnecting';
  // Newest first — the streamed authorization sits at the top of the feed.
  const rows = [...feed.transactions].reverse();

  return (
    <div className="border-cl-border bg-cl-surface overflow-hidden rounded-xl border">
      {reconnecting ? (
        <Alert
          tone="warning"
          title="Reconnecting…"
          message={`Retry in ${feed.retryDelaySeconds}s`}
        />
      ) : (
        <div className="border-cl-border flex items-center justify-between border-b px-4 py-2.75">
          <Text as="h4" size="label" weight="semibold" tone="default">
            Transactions
          </Text>
          <span className="text-cl-pos inline-flex items-center gap-1.5">
            <span
              className="bg-cl-pos inline-block h-2 w-2 rounded-full"
              style={{ animation: 'cl-pulse 1.4s ease-in-out infinite' }}
              aria-hidden="true"
            />
            <Text as="span" size="label" weight="semibold" className="text-cl-pos">
              Live &middot; WebSocket
            </Text>
          </span>
        </div>
      )}

      <div className="px-2 py-1">
        {rows.length === 0 ? (
          <Text as="p" size="label" tone="faint" className="px-2 py-6 text-center">
            {feed.connectionState === 'connecting'
              ? 'Connecting to the live feed…'
              : 'No transactions yet — authorizations will stream in here.'}
          </Text>
        ) : (
          rows.map((txn: CardTransaction, index) => {
            if (txn.status === 'declined') {
              return (
                <TransactionRow
                  key={txn.id}
                  merchant={txn.merchantName}
                  category={txn.mccLabel}
                  time={relativeTime(txn.occurredAt)}
                  amount={toMajorUnits(txn.amount)}
                  initials={txn.merchantInitials}
                  state="declined"
                  declineReason={feedDeclineLabel(
                    txn.declineReason ?? 'mcc_restricted',
                    txn.mccLabel,
                  )}
                />
              );
            }
            // The single most-recent approved row is the freshly-streamed one; older rows dim while
            // reconnecting so they don't read as the confirmed current state.
            const isNewest = index === 0;
            const state = reconnecting ? 'dim' : isNewest ? 'live' : 'default';
            return (
              <TransactionRow
                key={txn.id}
                merchant={txn.merchantName}
                category={txn.mccLabel}
                time={relativeTime(txn.occurredAt)}
                amount={toMajorUnits(txn.amount)}
                initials={txn.merchantInitials}
                state={state}
              />
            );
          })
        )}
      </div>

      {reconnecting && rows.length > 0 ? (
        <div className="bg-cl-inset border-cl-border border-t px-4 py-2 text-center">
          <Text as="span" size="mono" tone="faint">
            Showing last-known transactions — may not be current
          </Text>
        </div>
      ) : null}
    </div>
  );
}
