import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { useNewExpenseForm } from './use-new-expense-form';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const CONTEXT = {
  categories: [
    { id: 'travel', label: 'Travel' },
    { id: 'meals', label: 'Meals', perTransactionLimitMinorUnits: 7_500 },
    { id: 'software', label: 'Software', perTransactionLimitMinorUnits: 20_000 },
  ],
  receiptRequiredThresholdMinorUnits: 7_500,
  currency: 'USD',
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

async function renderForm() {
  setAccessToken('access_valid');
  server.use(http.get('*/api/expenses/context', () => HttpResponse.json(CONTEXT)));
  const view = renderHook(() => useNewExpenseForm(), { wrapper });
  await waitFor(() => expect(view.result.current.categories.length).toBeGreaterThan(0));
  return view;
}

describe('useNewExpenseForm', () => {
  it('routes and confirms a valid submission (AC-01)', async () => {
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
    const { result } = await renderForm();

    act(() => {
      result.current.setAmountInput('300');
      result.current.setCategoryId('travel');
    });
    act(() => result.current.attachReceipt(new File(['x'], 'receipt.jpg')));

    await waitFor(() => expect(result.current.canSubmit).toBe(true));
    act(() => result.current.onSubmit());

    await waitFor(() => expect(result.current.submitted?.status).toBe('pending_l1'));
    expect(result.current.submitted?.routedToName).toBe('Marcus Okafor');
  });

  it('blocks an over-$75 expense with no receipt (AC-02)', async () => {
    const { result } = await renderForm();
    act(() => {
      result.current.setAmountInput('120');
      result.current.setCategoryId('meals');
    });

    await waitFor(() => expect(result.current.activeError?.field).toBe('receipt'));
    expect(result.current.canSubmit).toBe(false);
  });

  it('warns but still allows submitting over a category policy limit (AC-03)', async () => {
    const { result } = await renderForm();
    act(() => {
      result.current.setAmountInput('350');
      result.current.setCategoryId('software');
    });
    act(() => result.current.attachReceipt(new File(['x'], 'invoice.pdf')));

    await waitFor(() => expect(result.current.policyWarning).toBe(true));
    expect(result.current.canSubmit).toBe(true);
  });
});
