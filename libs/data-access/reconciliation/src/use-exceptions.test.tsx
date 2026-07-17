import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { ReconciliationForbiddenError } from './reconciliation-forbidden-error';
import { useExceptions } from './use-exceptions';
import { useReconciliationSummary } from './use-reconciliation-summary';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

describe('useExceptions', () => {
  it('resolves with the exceptions queue', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/reconciliation/exceptions', () =>
        HttpResponse.json({
          exceptions: [
            {
              id: 'exc_1',
              bankTransaction: {
                id: 'b1',
                payee: 'ABC Corp',
                amount: { amountMinorUnits: 1, currency: 'USD' },
                date: '2026-06-27',
              },
              status: 'unmatched',
              reason: 'No candidate found',
            },
          ],
        }),
      ),
    );

    const { result } = renderHook(() => useExceptions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.exceptions).toHaveLength(1);
  });

  it('surfaces a 403 as ReconciliationForbiddenError', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/reconciliation/exceptions', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );

    const { result } = renderHook(() => useExceptions(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ReconciliationForbiddenError);
  });
});

describe('useReconciliationSummary', () => {
  it('surfaces a 500 as a panel error, not a forbidden error, so the page can scope the failure', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/reconciliation/summary', () =>
        HttpResponse.json({ error: 'section_unavailable' }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useReconciliationSummary(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).not.toBeInstanceOf(ReconciliationForbiddenError);
  });
});
