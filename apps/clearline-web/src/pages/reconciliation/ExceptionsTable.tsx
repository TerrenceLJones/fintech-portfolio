import type { ReconciliationException } from '@clearline/contracts';
import { formatMoneyValue, Button, EmptyState, StatusBadge, Text } from '@clearline/ui';
import { SimilarityPill } from './SimilarityPill';

export interface ExceptionsTableProps {
  exceptions: ReconciliationException[];
  onReview: (exception: ReconciliationException) => void;
  onSplit: (exception: ReconciliationException) => void;
  onConfirm: (exceptionId: string) => void;
  onDismiss: (exceptionId: string) => void;
  dismissingId?: string;
  confirmingId?: string;
}

function StatusCell({ exception }: { exception: ReconciliationException }) {
  if (exception.status === 'suggested' && typeof exception.similarityPercent === 'number') {
    return <SimilarityPill percent={exception.similarityPercent} />;
  }
  if (exception.status === 'ambiguous') {
    return <StatusBadge status="unmatched" label="Review" />;
  }
  return <StatusBadge status="unmatched" />;
}

function ActionCell({
  exception,
  onReview,
  onSplit,
  onConfirm,
  onDismiss,
  dismissing,
  confirming,
}: {
  exception: ReconciliationException;
  onReview: (exception: ReconciliationException) => void;
  onSplit: (exception: ReconciliationException) => void;
  onConfirm: (exceptionId: string) => void;
  onDismiss: (exceptionId: string) => void;
  dismissing: boolean;
  confirming: boolean;
}) {
  if (exception.status === 'suggested') {
    return (
      <Button variant="primary" size="sm" onClick={() => onReview(exception)}>
        Review
      </Button>
    );
  }

  const dismissButton = (
    <Button variant="ghost" size="sm" onClick={() => onDismiss(exception.id)} loading={dismissing}>
      Dismiss
    </Button>
  );

  // Ambiguous (possible duplicate): a person can accept the shown candidate as a manual match.
  if (exception.status === 'ambiguous' && exception.candidate) {
    return (
      <div className="flex justify-end gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => onConfirm(exception.id)}
          loading={confirming}
        >
          Match
        </Button>
        {dismissButton}
      </div>
    );
  }

  const canSplit = (exception.splitCandidates?.length ?? 0) > 0;
  return (
    <div className="flex justify-end gap-2">
      {canSplit ? (
        <Button variant="secondary" size="sm" onClick={() => onSplit(exception)}>
          Split
        </Button>
      ) : null}
      {dismissButton}
    </div>
  );
}

/**
 * The exceptions queue (US-CW-016 AC-02/AC-03): the bank lines the run couldn't auto-match, each kept
 * actionable — a suggestion is reviewed, an unmatched line dismissed or split. An empty queue is an
 * "all caught up" state, not an error. Status is always an icon + label (or a labelled score pill),
 * never colour alone.
 */
export function ExceptionsTable({
  exceptions,
  onReview,
  onSplit,
  onConfirm,
  onDismiss,
  dismissingId,
  confirmingId,
}: ExceptionsTableProps) {
  if (exceptions.length === 0) {
    return (
      <EmptyState
        icon="double-check"
        title="No exceptions to review"
        body="Every bank transaction reconciled cleanly against the ledger. Nothing needs your attention."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="bg-cl-inset text-cl-text-3 grid grid-cols-[1.4fr_1.4fr_0.9fr_1.2fr] gap-3 rounded-t-lg px-3 py-2">
          <Text as="span" size="label" weight="semibold" className="font-mono uppercase">
            Bank transaction
          </Text>
          <Text as="span" size="label" weight="semibold" className="font-mono uppercase">
            Ledger candidate
          </Text>
          <Text as="span" size="label" weight="semibold" className="font-mono uppercase">
            Status
          </Text>
          <Text as="span" size="label" weight="semibold" className="text-right font-mono uppercase">
            Action
          </Text>
        </div>

        {exceptions.map((exception) => (
          <div
            key={exception.id}
            className="border-cl-border grid grid-cols-[1.4fr_1.4fr_0.9fr_1.2fr] items-center gap-3 border-b px-3 py-3"
          >
            <div>
              <Text as="div" size="label" weight="medium" tone="default" className="mb-0.5">
                {exception.bankTransaction.payee}
              </Text>
              <Text as="div" size="label" tone="muted" className="mb-0 font-mono tabular-nums">
                {formatMoneyValue(exception.bankTransaction.amount)} ·{' '}
                {exception.bankTransaction.date}
              </Text>
            </div>
            <Text as="div" size="label" tone="muted" className="mb-0">
              {exception.candidate?.description ?? exception.reason}
            </Text>
            <div>
              <StatusCell exception={exception} />
            </div>
            <ActionCell
              exception={exception}
              onReview={onReview}
              onSplit={onSplit}
              onConfirm={onConfirm}
              onDismiss={onDismiss}
              dismissing={dismissingId === exception.id}
              confirming={confirmingId === exception.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
