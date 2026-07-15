import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { ExpenseContextForbiddenError, useExpenseContext } from './use-expense-context';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

describe('useExpenseContext', () => {
  it('returns categories and the receipt threshold', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/expenses/context', () =>
        HttpResponse.json({
          categories: [
            { id: 'software', label: 'Software', perTransactionLimitMinorUnits: 20_000 },
          ],
          receiptRequiredThresholdMinorUnits: 7_500,
          currency: 'USD',
        }),
      ),
    );

    const { result } = renderHook(() => useExpenseContext(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.receiptRequiredThresholdMinorUnits).toBe(7_500);
  });

  it('surfaces a 403 as ExpenseContextForbiddenError', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/expenses/context', () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 }),
      ),
    );

    const { result } = renderHook(() => useExpenseContext(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ExpenseContextForbiddenError);
  });
});
