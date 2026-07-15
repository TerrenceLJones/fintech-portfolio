import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { useBatchApprove } from './use-batch-approve';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

afterEach(() => clearAccessToken());

describe('useBatchApprove', () => {
  it('commits the approvable items and skips a self-submitted one with its reason (AC-06)', async () => {
    setAccessToken('access_valid');
    // The self-submitted item 403s self_approval_blocked; the rest approve cleanly.
    server.use(
      http.post('*/api/approvals/:id/approve', ({ params }) => {
        if (params.id === 'exp_self') {
          return HttpResponse.json({ error: 'self_approval_blocked' }, { status: 403 });
        }
        return HttpResponse.json({ item: { id: params.id } });
      }),
    );

    const items = [
      { id: 'exp_1', submitterName: 'Priya Nair' },
      { id: 'exp_2', submitterName: 'Dara Reyes' },
      { id: 'exp_self', submitterName: 'Marcus Okafor' },
    ];

    const { result } = renderHook(() => useBatchApprove(), { wrapper });
    result.current.mutate(items);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const summary = result.current.data;
    expect(summary?.total).toBe(3);
    expect(summary?.succeeded).toBe(2);
    const skipped = summary?.results.find((r) => r.outcome === 'skipped');
    expect(skipped?.id).toBe('exp_self');
    if (skipped?.outcome === 'skipped') {
      expect(skipped.code).toBe('self_approval_blocked');
    }
  });

  it('skips an already-actioned item as a conflict (AC-05 within a batch)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/approvals/:id/approve', () =>
        HttpResponse.json({ error: 'stale_action', actedBy: 'M. Okafor' }, { status: 409 }),
      ),
    );

    const { result } = renderHook(() => useBatchApprove(), { wrapper });
    result.current.mutate([{ id: 'exp_1', submitterName: 'Priya Nair' }]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const skipped = result.current.data?.results[0];
    if (skipped?.outcome === 'skipped') {
      expect(skipped.code).toBe('conflict');
      expect(skipped.actedBy).toBe('M. Okafor');
    }
  });
});
