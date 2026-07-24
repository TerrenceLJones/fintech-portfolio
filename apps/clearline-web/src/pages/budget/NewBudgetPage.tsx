import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  BudgetForbiddenError,
  useBudgetOverview,
  useSetBudget,
} from '@clearline/data-access-budgets';
import { AccessDenied, BudgetGauge, Button, Icon, Select, Text, TextField } from '@clearline/ui';
import { currencySymbol, parseAmountToMinorUnits, toMajorUnits } from '@clearline/money';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { usePageTitle } from '../../hooks/usePageTitle';
import { GettingStartedSpotlight } from '../../components/GettingStartedSpotlight';
import { budgetBeacon } from './BudgetOverviewPage.beacon';
import { BudgetError } from './budget-chrome';

/**
 * The Set-a-budget form (US-CW-019 AC-01). A Controller picks a department and its monthly budget;
 * saving stores it and starts the gauge at $0.00 spent — the live preview shows exactly that before
 * submit. The amount is parsed to exact minor units in the department's own currency (never an assumed
 * 2-decimal value), and the server re-validates it, surfacing a 422 as inline copy rather than a
 * silent failure. A 403 degrades to access-denied.
 */
export function NewBudgetPage() {
  usePageTitle('New budget');
  useDemoBeacon(budgetBeacon);
  const navigate = useNavigate();
  const submitRef = useRef<HTMLSpanElement>(null);
  const overview = useBudgetOverview();
  const setBudget = useSetBudget();

  const [department, setDepartment] = useState('');
  const [amountInput, setAmountInput] = useState('');

  const departments = overview.data?.budgets ?? [];
  const selected = departments.find((b) => b.department === department);
  const currency = selected?.budget.currency ?? 'USD';
  const amountMinorUnits = useMemo(
    () => parseAmountToMinorUnits(amountInput, currency),
    [amountInput, currency],
  );

  if (overview.error instanceof BudgetForbiddenError) {
    return <AccessDenied requestLine="403 Forbidden · GET /api/budgets" />;
  }

  // The form can't be filled without the department list, so a non-403 load failure gets its own retry
  // rather than a silently-empty dropdown — consistent with the overview and history pages.
  if (overview.isError || overview.isPending) {
    return (
      <div className="mx-auto max-w-md font-sans">
        <Text as="h1" size="heading" tone="default" className="mb-5">
          New budget
        </Text>
        {overview.isError ? (
          <BudgetError
            message="The department list couldn't load."
            onRetry={() => void overview.refetch()}
          />
        ) : (
          <div className="border-cl-border bg-cl-surface rounded-xl border p-[18px]">
            <div className="cl-skeleton mb-3 h-2.5 w-1/3 rounded" aria-hidden="true" />
            <div className="cl-skeleton mb-3 h-9 w-full rounded" aria-hidden="true" />
            <div className="cl-skeleton h-9 w-full rounded" aria-hidden="true" />
          </div>
        )}
      </div>
    );
  }

  const canSubmit = department.length > 0 && amountMinorUnits !== null && !setBudget.isPending;

  const onSubmit = () => {
    if (department.length === 0 || amountMinorUnits === null) return;
    setBudget.mutate(
      { department, amountMinorUnits, currency },
      { onSuccess: () => navigate('/budgets') },
    );
  };

  const previewTotal = amountMinorUnits !== null ? toMajorUnits({ amountMinorUnits, currency }) : 0;

  return (
    <div className="mx-auto max-w-md font-sans">
      <Text as="h1" size="heading" tone="default" className="mb-5">
        New budget
      </Text>

      <div className="mb-3.5">
        <Text as="span" size="label" weight="medium" tone="muted" className="mb-1.5 block">
          Department
        </Text>
        <Select
          aria-label="Department"
          placeholder="Select a department…"
          value={department}
          onValueChange={setDepartment}
          options={departments.map((b) => ({ value: b.department, label: b.department }))}
        />
      </div>

      <div className="mb-3.5 flex gap-3">
        <div className="flex-[1.2]">
          <TextField
            label="Monthly budget"
            inputMode="decimal"
            prefix={currencySymbol(currency)}
            placeholder="0.00"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            state={setBudget.isError ? 'error' : undefined}
          />
        </div>
        <div className="flex-1">
          <Text as="span" size="label" weight="medium" tone="muted" className="mb-1.5 block">
            Period
          </Text>
          <Select
            aria-label="Period"
            value="monthly"
            onValueChange={() => undefined}
            options={[{ value: 'monthly', label: 'Monthly' }]}
          />
        </div>
      </div>

      <div className="mb-4">
        <Text as="span" size="label" weight="medium" tone="muted" className="mb-1.5 block">
          Preview
        </Text>
        <BudgetGauge
          label={department || 'Department'}
          used={0}
          total={previewTotal}
          currency={currency}
        />
        <Text as="p" size="label" tone="faint" className="mt-1.5">
          Saving starts the gauge at {currencySymbol(currency)}0 spent of the monthly budget.
        </Text>
      </div>

      {setBudget.isError ? (
        <div className="mb-3 flex items-start gap-1.75" role="alert">
          <Icon name="x-circle" size={14} className="text-cl-neg mt-0.5 shrink-0" />
          <Text as="span" size="label" tone="critical">
            That budget couldn't be saved. Enter a positive amount and try again.
          </Text>
        </div>
      ) : null}

      <div className="flex gap-2.5">
        <Button variant="secondary" onClick={() => navigate('/budgets')}>
          Cancel
        </Button>
        <span ref={submitRef} className="flex-1">
          <Button fullWidth loading={setBudget.isPending} disabled={!canSubmit} onClick={onSubmit}>
            Save budget
          </Button>
        </span>
      </div>
      <GettingStartedSpotlight
        taskId="set-budget"
        anchorRef={submitRef}
        title="Set a budget"
        body="Give a department a spending limit to track against."
      />
    </div>
  );
}
