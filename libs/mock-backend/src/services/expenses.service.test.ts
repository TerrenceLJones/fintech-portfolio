import { describe, expect, it } from 'vitest';
import { permissionsForRole } from '@clearline/domain-auth';
import { ApprovalsService, type ApprovalActor } from './approvals.service';
import { ExpensesService, type ExpenseActor } from './expenses.service';

function actor(overrides: Partial<ExpenseActor> = {}): ExpenseActor {
  return {
    userId: 'user_1',
    displayName: 'Marcus Okafor',
    permissions: permissionsForRole('employee', { isAdmin: false }),
    ...overrides,
  };
}

function approvalActor(): ApprovalActor {
  return {
    userId: 'boss_1',
    displayName: 'Sofia Whitman',
    permissions: permissionsForRole('controller', { isAdmin: false }),
    approvalLimit: null,
  };
}

const baseRequest = {
  amount: { amountMinorUnits: 30_000, currency: 'USD' },
  categoryId: 'travel',
  merchant: 'United Airlines',
  receiptFilename: 'receipt.jpg',
};

describe('ExpensesService.getContext', () => {
  it('returns the categories and the receipt-required threshold', () => {
    const result = new ExpensesService().getContext(actor());
    expect(result.outcome).toBe('ok');
    if (result.outcome === 'ok') {
      expect(result.categories.map((c) => c.id)).toContain('software');
      expect(result.receiptRequiredThresholdMinorUnits).toBe(7_500);
      expect(result.currency).toBe('USD');
    }
  });
});

describe('ExpensesService.submit', () => {
  it('creates a pending expense, routes it, and enqueues it for the approver (AC-01)', () => {
    const approvals = new ApprovalsService();
    const service = new ExpensesService(undefined, undefined, approvals);

    const result = service.submit(
      baseRequest,
      actor({ userId: 'user_77', displayName: 'Dara Reyes' }),
    );
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.expense.status).toBe('pending_l1');
    expect(result.expense.submitterId).toBe('user_77');

    const queue = approvals.getQueue(approvalActor());
    if (queue.outcome === 'ok') {
      expect(queue.items.map((i) => i.id)).toContain(result.expense.id);
    }
  });

  it('routes an over-$10k expense straight to L2 (AC-04)', () => {
    const service = new ExpensesService();
    const result = service.submit(
      { ...baseRequest, amount: { amountMinorUnits: 2_500_000, currency: 'USD' } },
      actor(),
    );
    if (result.outcome === 'ok') {
      expect(result.expense.status).toBe('pending_l2');
    }
  });

  it('blocks an expense over $75 with no receipt (AC-02)', () => {
    const service = new ExpensesService();
    const result = service.submit(
      { amount: { amountMinorUnits: 12_000, currency: 'USD' }, categoryId: 'meals', merchant: 'X' },
      actor(),
    );
    expect(result).toEqual({ outcome: 'validation_error', reason: 'receipt_required' });
  });

  it('blocks a submission with an unknown/absent category', () => {
    const service = new ExpensesService();
    const result = service.submit({ ...baseRequest, categoryId: 'nope' }, actor());
    expect(result).toEqual({ outcome: 'validation_error', reason: 'category_required' });
  });

  it('flags (but allows) an expense over its category policy limit (AC-03)', () => {
    const service = new ExpensesService();
    const result = service.submit(
      {
        amount: { amountMinorUnits: 35_000, currency: 'USD' },
        categoryId: 'software',
        merchant: 'JetBrains',
        receiptFilename: 'invoice.pdf',
      },
      actor(),
    );
    expect(result.outcome).toBe('ok');
    if (result.outcome === 'ok') {
      expect(result.expense.policyFlagged).toBe(true);
    }
  });
});

describe('ExpensesService.listMine', () => {
  it('returns only the actor’s own expenses', () => {
    const result = new ExpensesService().listMine(actor());
    expect(result.outcome).toBe('ok');
    if (result.outcome === 'ok') {
      expect(result.expenses.every((e) => e.submitterId === 'user_1')).toBe(true);
    }
  });

  it('reflects an approver’s rejection (status + reason) in the submitter’s list (AC-02)', () => {
    const approvals = new ApprovalsService();
    const service = new ExpensesService([], undefined, approvals);
    const submitted = service.submit(baseRequest, actor());
    if (submitted.outcome !== 'ok') return;

    approvals.reject(submitted.expense.id, approvalActor(), 'Missing itemized receipt');

    const list = service.listMine(actor());
    if (list.outcome === 'ok') {
      const mine = list.expenses.find((e) => e.id === submitted.expense.id);
      expect(mine?.status).toBe('rejected');
      expect(mine?.rejectionReason).toBe('Missing itemized receipt');
    }
  });
});
