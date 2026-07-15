import { useState } from 'react';
import type { Expense, ExpenseCategory } from '@clearline/contracts';
import { exceedsCategoryLimit, validateExpense } from '@clearline/domain-expenses';
import { parseAmountToMinorUnits } from '@clearline/money';
import { formatMoneyValue } from '@clearline/ui';
import {
  ExpenseValidationError,
  useExpenseContext,
  useSubmitExpense,
} from '@clearline/data-access-expenses';

/** The org's expense currency until the context loads — replaced by the server-supplied value (AC single-currency). */
const FALLBACK_CURRENCY = 'USD';

/** A field-scoped inline error the form renders next to the offending input. */
export interface ExpenseFieldError {
  field: 'amount' | 'category' | 'receipt';
  message: string;
}

/** Maps a server 422 code to the same field-scoped error the client-side gate would have produced. */
function serverErrorToField(
  code: ExpenseValidationError['code'],
  threshold: number,
  currency: string,
): ExpenseFieldError {
  switch (code) {
    case 'receipt_required':
      return { field: 'receipt', message: receiptRequiredMessage(threshold, currency) };
    case 'category_required':
      return { field: 'category', message: 'Choose a category for this expense.' };
    default:
      return { field: 'amount', message: 'Enter a valid amount.' };
  }
}

function receiptRequiredMessage(thresholdMinorUnits: number, currency: string): string {
  const formatted = formatMoneyValue({ amountMinorUnits: thresholdMinorUnits, currency });
  return `A receipt is required for expenses over ${formatted}.`;
}

/**
 * All the state and derived validation for the New Expense form (US-CW-011). Mirrors the New Payment
 * form's shape: plain useState fields plus the shared @clearline/domain-expenses gate run client-side
 * in real time, so the receipt-required error and the advisory category policy-limit warning both
 * surface as the approver types — before submit, not after rejection (AC-02/AC-03). The server re-runs
 * the same gate; a 422 maps back to the same field error.
 */
export function useNewExpenseForm() {
  const context = useExpenseContext();
  const submit = useSubmitExpense();

  const [amountInput, setAmountInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [receiptFilename, setReceiptFilename] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Expense | null>(null);

  const categories: ExpenseCategory[] = context.data?.categories ?? [];
  const threshold = context.data?.receiptRequiredThresholdMinorUnits ?? 7_500;
  const currency = context.data?.currency ?? FALLBACK_CURRENCY;
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const amountMinor = parseAmountToMinorUnits(amountInput, currency);

  // Real-time policy feedback derived from the current field values (AC-03) — advisory, never blocks.
  const policyWarning =
    amountMinor !== null &&
    selectedCategory !== undefined &&
    exceedsCategoryLimit(selectedCategory.perTransactionLimitMinorUnits, amountMinor);

  // The client-side gate: the same validateExpense the server runs. Drives the blocking inline errors.
  const validation = validateExpense({
    amountMinorUnits: amountMinor ?? 0,
    categoryId: selectedCategory ? selectedCategory.id : null,
    hasReceipt: receiptFilename !== null,
  });

  // Only surface the receipt error once there's a valid amount over the threshold and no receipt, so
  // an empty form doesn't shout before the approver has entered anything.
  const clientError: ExpenseFieldError | null =
    !validation.ok && validation.reason === 'receipt_required'
      ? { field: 'receipt', message: receiptRequiredMessage(threshold, currency) }
      : null;

  const serverError =
    submit.error instanceof ExpenseValidationError
      ? serverErrorToField(submit.error.code, threshold, currency)
      : null;

  const activeError = serverError ?? clientError;
  const canSubmit = validation.ok && amountMinor !== null && !submit.isPending;

  function onSubmit() {
    if (amountMinor === null || !selectedCategory) return;
    submit.mutate(
      {
        amount: { amountMinorUnits: amountMinor, currency },
        categoryId: selectedCategory.id,
        merchant,
        ...(receiptFilename ? { receiptFilename } : {}),
        ...(policyWarning ? { policyLimitAcknowledged: true } : {}),
      },
      { onSuccess: (response) => setSubmitted(response.expense) },
    );
  }

  return {
    context,
    categories,
    threshold,
    currency,
    amountInput,
    setAmountInput,
    categoryId,
    setCategoryId,
    merchant,
    setMerchant,
    receiptFilename,
    attachReceipt: (file: File) => setReceiptFilename(file.name),
    policyWarning,
    policyLimitMinorUnits: selectedCategory?.perTransactionLimitMinorUnits,
    activeError,
    canSubmit,
    isSubmitting: submit.isPending,
    submitted,
    onSubmit,
  };
}

export type NewExpenseForm = ReturnType<typeof useNewExpenseForm>;
