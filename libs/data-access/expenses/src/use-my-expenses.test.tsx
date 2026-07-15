import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { useMyExpenses } from './use-my-expenses';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

describe('useMyExpenses', () => {
  it('returns the submitter’s expenses', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/expenses', () =>
        HttpResponse.json({
          expenses: [
            {
              id: 'exp_4490',
              submitterId: 'user_1',
              submitterName: 'Marcus Okafor',
              categoryId: 'travel',
              categoryLabel: 'Travel',
              merchant: 'United Airlines',
              amount: { amountMinorUnits: 124_000, currency: 'USD' },
              submittedDate: '2026-06-24',
              status: 'pending_l2',
            },
          ],
        }),
      ),
    );

    const { result } = renderHook(() => useMyExpenses(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.expenses[0]?.id).toBe('exp_4490');
  });
});
