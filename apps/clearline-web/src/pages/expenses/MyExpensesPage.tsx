import { useNavigate } from 'react-router';
import type { Expense, ExpenseStatus } from '@clearline/contracts';
import {
  Button,
  EmptyState,
  StatusBadge,
  Text,
  formatMoneyValue,
  type StatusKey,
} from '@clearline/ui';
import { useMyExpenses } from '@clearline/data-access-expenses';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { usePageTitle } from '../../hooks/usePageTitle';
import { myExpensesBeacon } from './MyExpensesPage.beacon';

/** Table columns: Merchant · category | Date | Amount | Status. */
const COLS = '1.6fr 0.9fr 0.9fr 1.1fr';

/** Maps the expense lifecycle onto the design-system status keys (glyph + label + color). */
const STATUS_DISPLAY: Record<ExpenseStatus, { key: StatusKey; label: string }> = {
  pending_l1: { key: 'pending-l1', label: 'Pending approval' },
  pending_l2: { key: 'pending-l2', label: 'Pending L2' },
  approved: { key: 'approved', label: 'Approved' },
  rejected: { key: 'rejected', label: 'Rejected' },
};

/** "2026-06-24" → "Jun 24" without pulling in a date lib. */
function formatSubmittedDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * My Expenses (US-CW-011). The employee's submitted expenses and their status, with a "+ New expense"
 * entry point. A rejected expense shows the approver's reason inline so the submitter can correct and
 * resubmit (US-CW-012 AC-02).
 */
export function MyExpensesPage() {
  usePageTitle('My Expenses');
  useDemoBeacon(myExpensesBeacon);
  const navigate = useNavigate();
  const query = useMyExpenses();
  const expenses = query.data?.expenses ?? [];

  return (
    <div className="font-sans">
      <div className="mb-5 flex items-center justify-between">
        <Text as="p" size="label" tone="muted">
          Your submitted expenses and their status
        </Text>
        <Button icon="plus" onClick={() => navigate('/expenses/new')}>
          New expense
        </Button>
      </div>

      {query.isPending ? (
        <Text as="p" size="label" tone="muted">
          Loading expenses…
        </Text>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="No expenses yet"
          body="Submit your first expense and track its approval here."
        />
      ) : (
        <div className="border-cl-border bg-cl-surface overflow-hidden rounded-xl border">
          <div
            className="bg-cl-inset border-cl-border text-cl-text-3 font-mono grid items-center border-b px-4 py-2.25 text-[11px] font-semibold tracking-wide uppercase"
            style={{ gridTemplateColumns: COLS }}
          >
            <div>Merchant · category</div>
            <div>Date</div>
            <div className="text-right">Amount</div>
            <div className="text-right">Status</div>
          </div>
          {expenses.map((expense: Expense, i: number) => {
            const display = STATUS_DISPLAY[expense.status];
            return (
              <div
                key={expense.id}
                data-expense-row
                className={[
                  'grid items-start gap-4 px-4 py-3.25 text-[13px]',
                  i < expenses.length - 1 ? 'border-cl-border border-b' : '',
                ].join(' ')}
                style={{ gridTemplateColumns: COLS }}
              >
                <div className="min-w-0">
                  <Text as="span" size="label" weight="medium" tone="default">
                    {expense.merchant}
                  </Text>
                  <Text as="p" size="label" tone="muted" className="mt-1 mb-0">
                    {expense.categoryLabel}
                    {expense.policyFlagged ? ' · flagged' : ''}
                  </Text>
                  {expense.status === 'rejected' && expense.rejectionReason ? (
                    <Text as="p" size="label" tone="critical" className="mt-1 mb-0">
                      {expense.rejectionReason}
                    </Text>
                  ) : null}
                </div>
                <Text as="div" size="mono" tone="muted" className="pt-0.5">
                  {formatSubmittedDate(expense.submittedDate)}
                </Text>
                <Text
                  as="div"
                  size="mono"
                  weight="semibold"
                  tone="default"
                  className="pt-0.5 text-right"
                >
                  {formatMoneyValue(expense.amount)}
                </Text>
                <div className="flex justify-end pt-0.5">
                  <StatusBadge status={display.key} label={display.label} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
