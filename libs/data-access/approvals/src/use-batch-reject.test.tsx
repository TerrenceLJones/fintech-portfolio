import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { useBatchReject } from './use-batch-reject';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

afterEach(() => clearAccessToken());

describe('useBatchReject', () => {
  it('applies the one shared reason to each selected item individually (AC-04)', async () => {
    setAccessToken('access_valid');
    const rejectedWithReason: Array<{ id: string; reason: string }> = [];
    server.use(
      http.post('*/api/approvals/:id/reject', async ({ request, params }) => {
        const { reason } = (await request.json()) as { reason: string };
        rejectedWithReason.push({ id: String(params.id), reason });
        return HttpResponse.json({ item: { id: params.id } });
      }),
    );

    const items = [
      { id: 'exp_1', submitterName: 'Olivia Brandt' },
      { id: 'exp_2', submitterName: 'James Lin' },
      { id: 'exp_3', submitterName: 'Nadia Hassan' },
    ];

    const { result } = renderHook(() => useBatchReject(), { wrapper });
    result.current.mutate({ items, reason: 'Missing receipts' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.succeeded).toBe(3);
    // The one shared reason is attached individually to every item — one call each, not a batched message.
    expect(rejectedWithReason).toEqual([
      { id: 'exp_1', reason: 'Missing receipts' },
      { id: 'exp_2', reason: 'Missing receipts' },
      { id: 'exp_3', reason: 'Missing receipts' },
    ]);
  });

  it('keeps confirmed rejections and resumes the rest after a mid-batch drop (AC-03)', async () => {
    setAccessToken('access_valid');
    let confirmed = 0;
    server.use(
      http.post('*/api/approvals/:id/reject', ({ params }) => {
        if (confirmed < 1) {
          confirmed += 1;
          return HttpResponse.json({ item: { id: params.id } });
        }
        return HttpResponse.error();
      }),
    );

    const items = [
      { id: 'exp_1', submitterName: 'A' },
      { id: 'exp_2', submitterName: 'B' },
      { id: 'exp_3', submitterName: 'C' },
    ];

    const { result } = renderHook(() => useBatchReject(), { wrapper });
    result.current.mutate({ items, reason: 'Wrong period' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const summary = result.current.data!;
    expect(summary.succeeded).toBe(1);
    expect(summary.results.map((r) => r.outcome)).toEqual([
      'succeeded',
      'not_processed',
      'not_processed',
    ]);
  });
});
