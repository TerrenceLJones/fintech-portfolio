import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { ApprovalPolicyResponse } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import {
  IncoherentPolicyError,
  useApprovalPolicy,
  useUpdateApprovalPolicy,
} from './use-approval-policy';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const POLICY: ApprovalPolicyResponse = {
  currency: 'USD',
  tiers: [
    { id: 't1', minMinorUnits: 0, maxMinorUnits: 1_000_000, approver: 'finance_manager' },
    { id: 't2', minMinorUnits: 1_000_001, maxMinorUnits: null, approver: 'controller' },
  ],
};

describe('useApprovalPolicy / useUpdateApprovalPolicy (AC-01/02)', () => {
  it('loads the ladder then persists a coherent edit', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/approval-policy', () => HttpResponse.json(POLICY)),
      http.patch('*/api/approval-policy', () =>
        HttpResponse.json({
          currency: 'USD',
          tiers: [{ id: 's0', minMinorUnits: 0, maxMinorUnits: null, approver: 'controller' }],
        }),
      ),
    );
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(
      () => ({ policy: useApprovalPolicy(), update: useUpdateApprovalPolicy() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.policy.isSuccess).toBe(true));
    expect(result.current.policy.data?.tiers).toHaveLength(2);

    result.current.update.mutate({
      tiers: [{ minMinorUnits: 0, maxMinorUnits: null, approver: 'controller' }],
    });
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(result.current.policy.data?.tiers).toHaveLength(1);
  });

  it('throws IncoherentPolicyError with the server issues on a 422 (AC-03/AC-04)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.patch('*/api/approval-policy', () =>
        HttpResponse.json(
          { error: 'incoherent_policy', issues: ['This range overlaps…'] },
          { status: 422 },
        ),
      ),
    );
    const { wrapper } = createQueryWrapper({
      queries: { retry: false },
      mutations: { retry: false },
    });
    const { result } = renderHook(() => useUpdateApprovalPolicy(), { wrapper });

    result.current.mutate({
      tiers: [{ minMinorUnits: 0, maxMinorUnits: null, approver: 'controller' }],
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(IncoherentPolicyError);
    expect((result.current.error as IncoherentPolicyError).issues).toEqual([
      'This range overlaps…',
    ]);
  });
});
