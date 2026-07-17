import type { MatchFieldVerdict, ReconciliationException } from '@clearline/contracts';
import { formatMoneyValue, Alert, Button, Icon, Modal, Text } from '@clearline/ui';
import { SimilarityPill } from './SimilarityPill';

const TONE_TEXT: Record<MatchFieldVerdict['tone'], string> = {
  positive: 'text-cl-pos',
  warning: 'text-cl-warn',
  negative: 'text-cl-neg',
};

function EntityCard({
  caption,
  name,
  amount,
  date,
}: {
  caption: string;
  name: string;
  amount: string;
  date: string;
}) {
  return (
    <div className="border-cl-border bg-cl-surface flex-1 rounded-lg border p-3">
      <Text as="div" size="label" tone="faint" className="mb-1 font-mono uppercase">
        {caption}
      </Text>
      <Text as="div" size="label" weight="semibold" tone="default" className="mb-0.5">
        {name}
      </Text>
      <Text as="div" size="label" tone="muted" className="mb-0 font-mono tabular-nums">
        {amount} · {date}
      </Text>
    </div>
  );
}

export interface FuzzyMatchDialogProps {
  exception: ReconciliationException;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReject: () => void;
  isConfirming: boolean;
  isRejecting: boolean;
  /** True when the last confirm/reject failed — shown inline so the dialog isn't a silent dead-end. */
  hasError?: boolean;
}

/**
 * The fuzzy-match review dialog (US-CW-016 AC-03). Shows the bank line beside its ledger candidate with
 * the overall similarity and a per-field breakdown (name/amount/date, each a coloured verdict, not
 * colour alone). Confirm creates a permanent match; Reject sends the line back to the exceptions queue.
 */
export function FuzzyMatchDialog({
  exception,
  open,
  onClose,
  onConfirm,
  onReject,
  isConfirming,
  isRejecting,
  hasError,
}: FuzzyMatchDialogProps) {
  const { bankTransaction, candidate, similarityPercent, fieldBreakdown } = exception;

  return (
    <Modal open={open} onOpenChange={(next) => (next ? undefined : onClose())} maxWidth={440}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Modal.Title asChild>
          <Text as="h3" size="heading" tone="default" className="mb-0">
            Suggested match
          </Text>
        </Modal.Title>
        {typeof similarityPercent === 'number' ? (
          <SimilarityPill percent={similarityPercent} label="similarity" />
        ) : null}
      </div>

      <div className="mb-4 flex items-stretch gap-2">
        <EntityCard
          caption="Bank feed"
          name={bankTransaction.payee}
          amount={formatMoneyValue(bankTransaction.amount)}
          date={bankTransaction.date}
        />
        <div className="flex items-center">
          <Icon name="arrow-right" size={16} className="text-cl-text-3" />
        </div>
        <EntityCard
          caption="Ledger entry"
          name={candidate?.description ?? '—'}
          amount={candidate ? formatMoneyValue(candidate.amount) : '—'}
          date={candidate?.date ?? '—'}
        />
      </div>

      {fieldBreakdown && fieldBreakdown.length > 0 ? (
        <div className="border-cl-border mb-4 flex flex-col gap-2 rounded-lg border p-3">
          {fieldBreakdown.map((verdict) => (
            <div key={verdict.field} className="flex items-center justify-between">
              <Text as="span" size="label" tone="muted" className="capitalize">
                {verdict.field}
              </Text>
              <Text as="span" size="label" weight="medium" className={TONE_TEXT[verdict.tone]}>
                {verdict.verdict}
              </Text>
            </div>
          ))}
        </div>
      ) : null}

      {hasError ? (
        <div className="mb-3">
          <Alert
            tone="negative"
            title="Couldn't complete that action"
            message="Please try again."
          />
        </div>
      ) : null}

      <div className="flex gap-2.5">
        <Button
          variant="secondary"
          fullWidth
          onClick={onReject}
          loading={isRejecting}
          disabled={isConfirming}
        >
          Reject
        </Button>
        <Button
          variant="primary"
          tone="positive"
          icon="check"
          fullWidth
          onClick={onConfirm}
          loading={isConfirming}
          disabled={isRejecting}
        >
          Confirm match
        </Button>
      </div>
    </Modal>
  );
}
