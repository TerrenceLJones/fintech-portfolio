import { useNavigate } from 'react-router';
import {
  AccessDenied,
  Button,
  DocumentDropzone,
  Icon,
  Select,
  Text,
  TextField,
  formatMoneyValue,
} from '@clearline/ui';
import { currencySymbol } from '@clearline/money';
import { ExpenseContextForbiddenError } from '@clearline/data-access-expenses';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useNewExpenseForm } from './use-new-expense-form';
import { ExpenseSubmittedCard } from './ExpenseSubmittedCard';
import { newExpenseBeacon } from './NewExpensePage.beacon';

/**
 * The New Expense form (US-CW-011). Amount, category, merchant and receipt, with real-time policy
 * feedback: a receipt over the $75 threshold is required and blocks submit (AC-02), while an amount
 * over its category's policy limit only warns and flags the expense for scrutiny (AC-03). On submit
 * the expense is routed to an approver and the confirmation surfaces where it went (AC-01).
 */
export function NewExpensePage() {
  usePageTitle('New expense');
  useDemoBeacon(newExpenseBeacon);
  const navigate = useNavigate();
  const form = useNewExpenseForm();

  if (form.context.error instanceof ExpenseContextForbiddenError) {
    return <AccessDenied requestLine="403 Forbidden · GET /api/expenses/context" />;
  }

  if (form.submitted) {
    return (
      <ExpenseSubmittedCard expense={form.submitted} onViewExpenses={() => navigate('/expenses')} />
    );
  }

  const categoryOptions = form.categories.map((category) => ({
    value: category.id,
    label: category.label,
    ...(category.perTransactionLimitMinorUnits !== undefined
      ? {
          description: `Policy limit ${formatMoneyValue({
            amountMinorUnits: category.perTransactionLimitMinorUnits,
            currency: form.currency,
          })}`,
        }
      : {}),
  }));

  return (
    <div className="mx-auto max-w-md font-sans">
      <Text as="h1" size="heading" tone="default" className="mb-5">
        New expense
      </Text>

      <div className="mb-3.5 flex gap-3">
        <div className="flex-[1.1]">
          <TextField
            label="Amount"
            inputMode="decimal"
            prefix={currencySymbol(form.currency)}
            placeholder="0.00"
            value={form.amountInput}
            onChange={(event) => form.setAmountInput(event.target.value)}
            state={form.activeError?.field === 'amount' ? 'error' : undefined}
          />
        </div>
        <div className="flex-1">
          <Text as="span" size="label" weight="medium" tone="muted" className="mb-1.5 block">
            Category
          </Text>
          <Select
            aria-label="Category"
            placeholder="Select…"
            value={form.categoryId}
            onValueChange={form.setCategoryId}
            options={categoryOptions}
          />
        </div>
      </div>

      <div className="mb-3.5">
        <TextField
          label="Merchant"
          placeholder="Who was paid"
          value={form.merchant}
          onChange={(event) => form.setMerchant(event.target.value)}
        />
      </div>

      {form.policyWarning && form.policyLimitMinorUnits !== undefined ? (
        <div className="mb-4 flex items-start gap-1.75" role="alert">
          <Icon name="triangle-alert" size={14} className="text-cl-warn mt-0.5 shrink-0" />
          <Text as="span" size="label" tone="warning">
            This exceeds the{' '}
            {formatMoneyValue({
              amountMinorUnits: form.policyLimitMinorUnits,
              currency: form.currency,
            })}{' '}
            policy limit for this category
          </Text>
        </div>
      ) : null}

      <div className="mb-2">
        <Text as="span" size="label" weight="medium" tone="muted" className="mb-1.5 block">
          Receipt
        </Text>
        <DocumentDropzone
          label={form.receiptFilename ?? 'Attach a receipt'}
          status={form.receiptFilename ? 'accepted' : 'idle'}
          onFileSelected={form.attachReceipt}
        />
      </div>

      {form.activeError?.field === 'receipt' ? (
        <div className="mb-3 flex items-start gap-1.75" role="alert">
          <Icon name="x-circle" size={14} className="text-cl-neg mt-0.5 shrink-0" />
          <Text as="span" size="label" tone="critical">
            {form.activeError.message}
          </Text>
        </div>
      ) : (
        <div className="mb-3" />
      )}

      <Button
        fullWidth
        variant={form.policyWarning ? 'secondary' : 'primary'}
        tone={form.policyWarning ? 'warning' : undefined}
        loading={form.isSubmitting}
        disabled={!form.canSubmit}
        onClick={form.onSubmit}
      >
        {form.policyWarning ? 'Submit anyway · will be flagged' : 'Submit for approval'}
      </Button>
    </div>
  );
}
