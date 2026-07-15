import type { Expense } from '@clearline/contracts';
import { Button, Icon, Text, formatMoneyValue } from '@clearline/ui';

export interface ExpenseSubmittedCardProps {
  expense: Expense;
  onViewExpenses: () => void;
}

/**
 * The post-submit confirmation (US-CW-011 AC-01): a success mark, where the expense was routed, and
 * its pending status. A distinct view from the form, so it lives in its own component.
 */
export function ExpenseSubmittedCard({ expense, onViewExpenses }: ExpenseSubmittedCardProps) {
  return (
    <div className="mx-auto max-w-md py-10 text-center font-sans">
      <div className="bg-cl-pos mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
        <Icon name="check" size={26} className="text-white" />
      </div>
      <Text as="h2" size="heading" tone="default" className="mb-2">
        Expense submitted for approval
      </Text>
      <Text as="p" size="label" tone="muted" className="mx-auto mb-5 max-w-xs">
        {formatMoneyValue(expense.amount)} · {expense.categoryLabel}
        {expense.routedToName ? ` · routed to ${expense.routedToName}` : ''}.
      </Text>
      <div className="bg-cl-pending-weak mb-6 inline-flex items-center gap-1.5 rounded-lg px-3 py-1">
        <Icon name="clock" size={12} className="text-cl-pending" />
        <Text as="span" size="label" weight="semibold" tone="warning">
          {expense.status === 'pending_l2' ? 'Pending L2 approval' : 'Pending approval'}
        </Text>
      </div>
      <div className="flex justify-center gap-2.5">
        <Button variant="secondary" onClick={onViewExpenses}>
          View my expenses
        </Button>
      </div>
    </div>
  );
}
