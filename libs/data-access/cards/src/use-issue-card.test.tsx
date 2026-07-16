import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { CardResponse, IssueCardRequest } from '@clearline/contracts';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { useIssueCard, CardIssueError } from './use-issue-card';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

afterEach(() => clearAccessToken());

const request: IssueCardRequest = {
  holderId: 'emp_reyes',
  monthlyLimit: { amountMinorUnits: 200_000, currency: 'USD' },
  allowedMccs: ['software', 'office_supplies'],
};

const issued: CardResponse = {
  card: {
    id: 'card_new',
    holderName: 'Dara Reyes — Design',
    holderInitials: 'DR',
    last4: '4102',
    exp: '09/28',
    monthlyLimit: { amountMinorUnits: 200_000, currency: 'USD' },
    authorizedSpend: { amountMinorUnits: 0, currency: 'USD' },
    status: 'active',
    allowedMccs: ['software', 'office_supplies'],
  },
};

describe('useIssueCard', () => {
  it('issues a card on success', async () => {
    setAccessToken('access_valid');
    server.use(http.post('*/api/cards', () => HttpResponse.json(issued, { status: 201 })));

    const { result } = renderHook(() => useIssueCard(), { wrapper });
    result.current.mutate(request);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.card.id).toBe('card_new');
  });

  it('maps a 422 invalid_limit to a typed CardIssueError', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/cards', () =>
        HttpResponse.json({ error: 'invalid_limit' }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useIssueCard(), { wrapper });
    result.current.mutate({ ...request, monthlyLimit: { amountMinorUnits: 0, currency: 'USD' } });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(CardIssueError);
    expect((result.current.error as CardIssueError).code).toBe('invalid_limit');
  });

  it('maps a 403 to a forbidden CardIssueError', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/cards', () => HttpResponse.json({ error: 'forbidden' }, { status: 403 })),
    );

    const { result } = renderHook(() => useIssueCard(), { wrapper });
    result.current.mutate(request);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as CardIssueError).code).toBe('forbidden');
  });
});
