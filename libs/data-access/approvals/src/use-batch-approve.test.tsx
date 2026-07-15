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

  it('stamps every result with a stable idempotency key so a retry can re-send the same key (AC-02)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/approvals/:id/approve', ({ params }) =>
        HttpResponse.json({ item: { id: params.id } }),
      ),
    );

    const { result } = renderHook(() => useBatchApprove(), { wrapper });
    result.current.mutate([{ id: 'exp_1', submitterName: 'Priya Nair' }]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const item = result.current.data!.results[0]!;
    expect(item.idempotencyKey).toEqual(expect.any(String));
    expect(item.idempotencyKey.length).toBeGreaterThan(0);
  });

  it('reuses a caller-supplied idempotency key instead of minting a new one (safe partial retry, AC-02)', async () => {
    setAccessToken('access_valid');
    let seenKey: string | null = null;
    server.use(
      http.post('*/api/approvals/:id/approve', ({ request, params }) => {
        seenKey = request.headers.get('idempotency-key');
        return HttpResponse.json({ item: { id: params.id } });
      }),
    );

    const { result } = renderHook(() => useBatchApprove(), { wrapper });
    result.current.mutate([
      { id: 'exp_1', submitterName: 'Priya Nair', idempotencyKey: 'reuse-me' },
    ]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenKey).toBe('reuse-me');
    expect(result.current.data!.results[0]!.idempotencyKey).toBe('reuse-me');
  });

  it('confirms items before a mid-batch network drop and marks the rest not_processed (AC-03)', async () => {
    setAccessToken('access_valid');
    // First 2 approvals confirm; the connection then drops for every remaining item.
    let confirmed = 0;
    server.use(
      http.post('*/api/approvals/:id/approve', ({ params }) => {
        if (confirmed < 2) {
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
      { id: 'exp_4', submitterName: 'D' },
    ];

    const { result } = renderHook(() => useBatchApprove(), { wrapper });
    result.current.mutate(items);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const summary = result.current.data!;
    expect(summary.succeeded).toBe(2);
    const outcomes = summary.results.map((r) => r.outcome);
    expect(outcomes).toEqual(['succeeded', 'succeeded', 'not_processed', 'not_processed']);
  });

  it('reports the in-flight item with the SAME key it was sent, so a resume replays not double-applies (AC-03)', async () => {
    setAccessToken('access_valid');
    // The item that drops mid-flight may have committed server-side before the response was lost;
    // its not_processed result must carry the exact key the request used, so the resume dedupes.
    const sentKeyById = new Map<string, string>();
    server.use(
      http.post('*/api/approvals/:id/approve', ({ request, params }) => {
        sentKeyById.set(String(params.id), request.headers.get('idempotency-key') ?? '');
        return HttpResponse.error();
      }),
    );

    const { result } = renderHook(() => useBatchApprove(), { wrapper });
    result.current.mutate([{ id: 'exp_1', submitterName: 'Priya Nair' }]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const item = result.current.data!.results[0]!;
    expect(item.outcome).toBe('not_processed');
    expect(item.idempotencyKey).toBe(sentKeyById.get('exp_1'));
    expect(item.idempotencyKey).not.toBe('');
  });
});
