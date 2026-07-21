import { describe, expect, it } from 'vitest';
import { permissionsForRole } from '@clearline/domain-auth';
import { DEFAULT_APPROVAL_TIERS } from '@clearline/domain-expenses';
import { ApprovalsService, type ApprovalActor } from './approvals.service';
import { ExpensesService, type ExpenseActor, type ExpensePolicyProvider } from './expenses.service';

function actor(overrides: Partial<ExpenseActor> = {}): ExpenseActor {
  return {
    userId: 'user_1',
    displayName: 'Marcus Okafor',
    permissions: permissionsForRole('employee', { isAdmin: false }),
    orgId: 'org_clearline_demo',
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

describe('ExpensesService.submit — policy-driven enforcement (US-CW-037)', () => {
  /** A service wired with a specific approval + spend-control policy. */
  function withPolicy(policy: Partial<ExpensePolicyProvider>): ExpensesService {
    const provider: ExpensePolicyProvider = {
      approvalTiers: policy.approvalTiers ?? (() => DEFAULT_APPROVAL_TIERS.map((t) => ({ ...t }))),
      spendControls:
        policy.spendControls ??
        (() => ({
          receiptRequiredThresholdMinorUnits: 7_500,
          memoRequiredThresholdMinorUnits: 0,
          outOfPolicyBehavior: 'flag',
          categoryCaps: {},
        })),
    };
    return new ExpensesService([], undefined, new ApprovalsService(), () => Date.now(), provider);
  }

  it('auto-approves an expense that falls in an auto-approve tier and skips the queue (AC-10)', () => {
    const approvals = new ApprovalsService();
    const provider: ExpensePolicyProvider = {
      approvalTiers: () => [
        { id: 'a', minMinorUnits: 0, maxMinorUnits: 100_000, approver: 'auto' },
        { id: 'b', minMinorUnits: 100_001, maxMinorUnits: null, approver: 'controller' },
      ],
      spendControls: () => ({
        receiptRequiredThresholdMinorUnits: 7_500,
        memoRequiredThresholdMinorUnits: 0,
        outOfPolicyBehavior: 'flag',
        categoryCaps: {},
      }),
    };
    const service = new ExpensesService([], undefined, approvals, () => Date.now(), provider);

    const result = service.submit(
      {
        amount: { amountMinorUnits: 5_000, currency: 'USD' },
        categoryId: 'travel',
        merchant: 'Lyft',
      },
      actor(),
    );
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.expense.status).toBe('approved');
    const queue = approvals.getQueue(approvalActor());
    if (queue.outcome === 'ok') {
      expect(queue.items.map((i) => i.id)).not.toContain(result.expense.id);
    }
  });

  it('blocks an over-memo-threshold expense with no memo, and allows it with one (AC-06)', () => {
    const service = withPolicy({
      spendControls: () => ({
        receiptRequiredThresholdMinorUnits: 7_500,
        memoRequiredThresholdMinorUnits: 20_000,
        outOfPolicyBehavior: 'flag',
        categoryCaps: {},
      }),
    });
    const req = {
      amount: { amountMinorUnits: 25_000, currency: 'USD' },
      categoryId: 'travel',
      merchant: 'Hotel',
      receiptFilename: 'r.jpg',
    };
    expect(service.submit(req, actor())).toEqual({
      outcome: 'validation_error',
      reason: 'memo_required',
    });
    expect(service.submit({ ...req, memo: 'Client trip' }, actor()).outcome).toBe('ok');
  });

  it('hard-blocks an over-category-limit expense when out-of-policy behavior is block (AC-07)', () => {
    const service = withPolicy({
      spendControls: () => ({
        receiptRequiredThresholdMinorUnits: 7_500,
        memoRequiredThresholdMinorUnits: 0,
        outOfPolicyBehavior: 'block',
        categoryCaps: {},
      }),
    });
    // Software carries a $200 per-transaction limit; a $350 software expense exceeds it.
    const result = service.submit(
      {
        amount: { amountMinorUnits: 35_000, currency: 'USD' },
        categoryId: 'software',
        merchant: 'JetBrains',
        receiptFilename: 'i.pdf',
      },
      actor(),
    );
    expect(result).toEqual({ outcome: 'validation_error', reason: 'over_policy_blocked' });
  });

  it('blocks a submission that would push month-to-date category spend over its cap (AC-08)', () => {
    const service = withPolicy({
      spendControls: () => ({
        receiptRequiredThresholdMinorUnits: 7_500,
        memoRequiredThresholdMinorUnits: 0,
        outOfPolicyBehavior: 'flag',
        categoryCaps: { travel: 30_000 },
      }),
    });
    const first = service.submit(
      {
        amount: { amountMinorUnits: 20_000, currency: 'USD' },
        categoryId: 'travel',
        merchant: 'A',
        receiptFilename: 'a.jpg',
      },
      actor(),
    );
    expect(first.outcome).toBe('ok');
    // A second $20 pushes the month-to-date to $40, over the $30 cap.
    const second = service.submit(
      {
        amount: { amountMinorUnits: 20_000, currency: 'USD' },
        categoryId: 'travel',
        merchant: 'B',
        receiptFilename: 'b.jpg',
      },
      actor(),
    );
    expect(second).toEqual({ outcome: 'validation_error', reason: 'over_category_cap' });
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
