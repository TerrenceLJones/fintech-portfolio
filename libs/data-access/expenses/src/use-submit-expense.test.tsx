import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { ExpenseValidationError, useSubmitExpense } from './use-submit-expense';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

afterEach(() => clearAccessToken());

const request = {
  amount: { amountMinorUnits: 30_000, currency: 'USD' },
  categoryId: 'travel',
  merchant: 'United Airlines',
  receiptFilename: 'receipt.jpg',
};

describe('useSubmitExpense', () => {
  it('resolves with the created expense on a 201', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/expenses', () =>
        HttpResponse.json(
          {
            expense: {
              id: 'exp_4600',
              submitterId: 'user_1',
              submitterName: 'Marcus Okafor',
              categoryId: 'travel',
              categoryLabel: 'Travel',
              merchant: 'United Airlines',
              amount: { amountMinorUnits: 30_000, currency: 'USD' },
              submittedDate: '2026-07-14',
              status: 'pending_l1',
              routedToName: 'Marcus Okafor',
            },
          },
          { status: 201 },
        ),
      ),
    );

    const { result } = renderHook(() => useSubmitExpense(), { wrapper });
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.expense.status).toBe('pending_l1');
  });

  it('throws a typed ExpenseValidationError on a 422 receipt_required (AC-02)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/expenses', () =>
        HttpResponse.json({ error: 'receipt_required' }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useSubmitExpense(), { wrapper });
    result.current.mutate({ ...request, receiptFilename: undefined });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error;
    expect(error).toBeInstanceOf(ExpenseValidationError);
    expect((error as ExpenseValidationError).code).toBe('receipt_required');
  });
});
