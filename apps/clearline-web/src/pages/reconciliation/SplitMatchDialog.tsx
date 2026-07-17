import { useState } from 'react';
import type { Money, ReconciliationException, SplitPortion } from '@clearline/contracts';
import { validateSplit } from '@clearline/domain-reconciliation';
import { toMajorUnits, toMinorUnits } from '@clearline/money';
import { formatMoneyValue, Alert, Button, Icon, Modal, Text } from '@clearline/ui';

export interface SplitMatchDialogProps {
  exception: ReconciliationException;
  open: boolean;
  onClose: () => void;
  onSplit: (portions: SplitPortion[]) => void;
  isSplitting: boolean;
  /** True when the server rejected the split — shown inline so a failed submit isn't silent. */
  hasError?: boolean;
}

/**
 * The split-match dialog (US-CW-016 AC-05). One editable portion per ledger candidate; the portions must
 * sum *exactly* to the bank transaction amount. Validation runs live with the same `validateSplit`
 * domain rule the server enforces — the balance strip turns positive only when it balances, and Confirm
 * stays disabled with the "must add up to the full transaction amount" message until it does.
 */
export function SplitMatchDialog({
  exception,
  open,
  onClose,
  onSplit,
  isSplitting,
  hasError,
}: SplitMatchDialogProps) {
  const { bankTransaction, splitCandidates = [] } = exception;
  const currency = bankTransaction.amount.currency;

  // Portion amounts as the user's major-unit strings, keyed by ledger entry id; seeded from each candidate.
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(splitCandidates.map((c) => [c.id, String(toMajorUnits(c.amount))])),
  );

  const money = (amountMinorUnits: number): Money => ({ amountMinorUnits, currency });
  const toMinor = (value: string): number => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? toMinorUnits(parsed, currency) : 0;
  };

  const portionMinors = splitCandidates.map((c) => toMinor(amounts[c.id] ?? ''));
  const validation = validateSplit(bankTransaction.amount.amountMinorUnits, portionMinors);
  const providedMoney = money(validation.providedMinorUnits);
  const expectedMoney = money(validation.expectedMinorUnits);
  const shortfallMoney = money(Math.abs(validation.differenceMinorUnits));

  const submit = () => {
    const portions: SplitPortion[] = splitCandidates.map((c, i) => ({
      ledgerEntryId: c.id,
      label: c.description,
      amount: money(portionMinors[i] ?? 0),
    }));
    onSplit(portions);
  };

  return (
    <Modal open={open} onOpenChange={(next) => (next ? undefined : onClose())} maxWidth={440}>
      <Modal.Title asChild>
        <Text as="h3" size="heading" tone="default" className="mb-3">
          Split match
        </Text>
      </Modal.Title>

      <div className="bg-cl-inset mb-4 flex items-center justify-between rounded-lg px-3.5 py-2.75">
        <Text as="span" size="label" weight="semibold" tone="default">
          {bankTransaction.payee}
        </Text>
        <span className="text-cl-text font-mono text-[15px] font-semibold tabular-nums">
          {formatMoneyValue(bankTransaction.amount)}
        </span>
      </div>

      <div className="mb-4 flex flex-col gap-2.5">
        {splitCandidates.map((candidate) => (
          <div
            key={candidate.id}
            className="border-cl-border-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
          >
            <Text
              as="label"
              size="label"
              weight="medium"
              tone="default"
              htmlFor={`portion-${candidate.id}`}
            >
              {candidate.description}
            </Text>
            <div className="flex items-center gap-1">
              <Text as="span" size="label" tone="faint">
                $
              </Text>
              <input
                id={`portion-${candidate.id}`}
                aria-label={`Amount for ${candidate.description}`}
                inputMode="decimal"
                value={amounts[candidate.id] ?? ''}
                onChange={(e) =>
                  setAmounts((prev) => ({ ...prev, [candidate.id]: e.target.value }))
                }
                className="border-cl-border-2 bg-cl-surface text-cl-text w-28 rounded-md border px-2 py-1 text-right font-mono text-[13px] tabular-nums"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Balance strip — positive only when the portions net to the source amount. */}
      {validation.ok ? (
        <div className="bg-cl-pos-weak mb-4 flex items-center justify-between rounded-lg px-3.5 py-2.5">
          <span className="flex items-center gap-2">
            <Icon name="check" size={15} className="text-cl-pos" />
            <Text as="span" size="label" weight="semibold" className="text-cl-pos">
              Splits balance
            </Text>
          </span>
          <span className="text-cl-pos font-mono text-[13px] tabular-nums">
            {formatMoneyValue(providedMoney)} of {formatMoneyValue(expectedMoney)}
          </span>
        </div>
      ) : (
        <div
          className="bg-cl-neg-weak mb-4 flex items-start gap-2.5 rounded-lg px-3.5 py-2.5"
          role="alert"
        >
          <Icon name="x-circle" size={16} className="text-cl-neg mt-0.5 shrink-0" />
          <div>
            <Text as="div" size="label" weight="medium" className="text-cl-neg mb-0.5">
              The split amounts must add up to the full transaction amount.
            </Text>
            <Text as="div" size="label" tone="faint" className="mb-0 font-mono tabular-nums">
              {formatMoneyValue(providedMoney)} of {formatMoneyValue(expectedMoney)} ·{' '}
              {formatMoneyValue(shortfallMoney)}{' '}
              {validation.differenceMinorUnits < 0 ? 'short' : 'over'}
            </Text>
          </div>
        </div>
      )}

      {hasError ? (
        <div className="mb-3">
          <Alert
            tone="negative"
            title="Couldn't save the split"
            message="The server rejected it. Please try again."
          />
        </div>
      ) : null}

      <Button
        variant="primary"
        fullWidth
        icon="check"
        onClick={submit}
        loading={isSplitting}
        disabled={!validation.ok}
      >
        Confirm split match
      </Button>
    </Modal>
  );
}
