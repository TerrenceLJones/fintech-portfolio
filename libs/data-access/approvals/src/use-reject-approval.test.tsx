import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { ApprovalConflictError } from './approval-conflict-error';
import { requestReject, useRejectApproval } from './use-reject-approval';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

afterEach(() => clearAccessToken());

describe('useRejectApproval', () => {
  it('sends the required reason and resolves with the rejected item (AC-02)', async () => {
    setAccessToken('access_valid');
    let sentReason: string | undefined;
    server.use(
      http.post('*/api/approvals/:id/reject', async ({ request }) => {
        sentReason = ((await request.json()) as { reason: string }).reason;
        return HttpResponse.json({
          item: {
            id: 'exp_4201',
            submitterId: 'user_201',
            submitterName: 'Priya Nair',
            category: 'Software',
            amount: { amountMinorUnits: 420_000, currency: 'USD' },
            submittedDate: '2026-06-28',
            status: 'pending_l1',
          },
        });
      }),
    );

    const { result } = renderHook(() => useRejectApproval(), { wrapper });
    result.current.mutate({ id: 'exp_4201', reason: 'Out of policy' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.item.id).toBe('exp_4201');
    expect(sentReason).toBe('Out of policy');
  });

  it('surfaces a 409 as ApprovalConflictError naming who already actioned it (AC-05)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/approvals/:id/reject', () =>
        HttpResponse.json({ error: 'stale_action', actedBy: 'Marcus Okafor' }, { status: 409 }),
      ),
    );

    const { result } = renderHook(() => useRejectApproval(), { wrapper });
    result.current.mutate({ id: 'exp_4201', reason: 'Duplicate' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApprovalConflictError);
    expect((result.current.error as ApprovalConflictError).actedBy).toBe('Marcus Okafor');
  });

  it('sends the Idempotency-Key header when a key is provided, so a resumed batch reject dedupes (US-CW-013 AC-02)', async () => {
    setAccessToken('access_valid');
    let seenKey: string | null = null;
    server.use(
      http.post('*/api/approvals/:id/reject', ({ request, params }) => {
        seenKey = request.headers.get('idempotency-key');
        return HttpResponse.json({ item: { id: params.id } });
      }),
    );

    await requestReject({
      id: 'exp_4201',
      reason: 'Missing receipts',
      idempotencyKey: 'rej-key-1',
    });
    expect(seenKey).toBe('rej-key-1');
  });
});
