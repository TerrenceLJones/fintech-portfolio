import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { SplitMismatchError } from './split-mismatch-error';
import { useSplitMatch } from './use-split-match';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false }, mutations: { retry: false } });

const usd = (amountMinorUnits: number) => ({ amountMinorUnits, currency: 'USD' });
const INPUT = {
  exceptionId: 'exc_bank_acme',
  portions: [{ ledgerEntryId: 'led_1', label: 'INV-1', amount: usd(300_000) }],
};

afterEach(() => clearAccessToken());

describe('useSplitMatch', () => {
  it('returns the committed match on success', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/reconciliation/exceptions/:id/split', () =>
        HttpResponse.json({ matched: { id: 'match_1', method: 'split', ledgerEntries: [] } }),
      ),
    );

    const { result } = renderHook(() => useSplitMatch(), { wrapper });
    result.current.mutate(INPUT);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.method).toBe('split');
  });

  it('maps a 422 split_mismatch to a typed SplitMismatchError with the totals (AC-05)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/reconciliation/exceptions/:id/split', () =>
        HttpResponse.json(
          { error: 'split_mismatch', expected: usd(500_000), provided: usd(450_000) },
          { status: 422 },
        ),
      ),
    );

    const { result } = renderHook(() => useSplitMatch(), { wrapper });
    result.current.mutate(INPUT);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error;
    expect(error).toBeInstanceOf(SplitMismatchError);
    if (error instanceof SplitMismatchError) {
      expect(error.expected.amountMinorUnits).toBe(500_000);
      expect(error.provided.amountMinorUnits).toBe(450_000);
    }
  });
});
