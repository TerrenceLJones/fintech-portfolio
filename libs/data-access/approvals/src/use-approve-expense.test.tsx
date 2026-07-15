import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { ApprovalError, requestApprove, useApproveExpense } from './use-approve-expense';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

afterEach(() => clearAccessToken());

describe('useApproveExpense', () => {
  it('resolves on a 200 approval', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/approvals/:id/approve', () =>
        HttpResponse.json({
          item: {
            id: 'exp_4201',
            submitterId: 'user_201',
            submitterName: 'Priya Nair',
            category: 'Software',
            amount: { amountMinorUnits: 420_000, currency: 'USD' },
            submittedDate: '2026-06-28',
            status: 'pending_l1',
          },
        }),
      ),
    );

    const { result } = renderHook(() => useApproveExpense(), { wrapper });
    result.current.mutate('exp_4201');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.item.id).toBe('exp_4201');
  });

  it('throws a typed ApprovalError with the limit on an over-limit 403 (AC-06)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/approvals/:id/approve', () =>
        HttpResponse.json(
          { error: 'approval_limit_exceeded', approvalLimit: 1_000_000 },
          { status: 403 },
        ),
      ),
    );

    const { result } = renderHook(() => useApproveExpense(), { wrapper });
    result.current.mutate('exp_4471');

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error;
    expect(error).toBeInstanceOf(ApprovalError);
    expect((error as ApprovalError).code).toBe('approval_limit_exceeded');
    expect((error as ApprovalError).approvalLimit).toBe(1_000_000);
  });

  it('throws a typed ApprovalError on a self-approval 403 (AC-07)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/approvals/:id/approve', () =>
        HttpResponse.json({ error: 'self_approval_blocked' }, { status: 403 }),
      ),
    );

    const { result } = renderHook(() => useApproveExpense(), { wrapper });
    result.current.mutate('exp_4460');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ApprovalError).code).toBe('self_approval_blocked');
  });

  it('sends the Idempotency-Key header when a key is provided, so batch retries dedupe (US-CW-013 AC-02)', async () => {
    setAccessToken('access_valid');
    let seenKey: string | null = null;
    server.use(
      http.post('*/api/approvals/:id/approve', ({ request, params }) => {
        seenKey = request.headers.get('idempotency-key');
        return HttpResponse.json({ item: { id: params.id } });
      }),
    );

    await requestApprove('exp_4201', 'idem-key-1');
    expect(seenKey).toBe('idem-key-1');
  });
});
