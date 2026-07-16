import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { CardListResponse } from '@clearline/contracts';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { useCards, CardsForbiddenError } from './use-cards';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

const walletBody: CardListResponse = {
  cards: [
    {
      id: 'card_4021',
      holderName: 'Dara Reyes — Design',
      holderInitials: 'DR',
      last4: '4021',
      exp: '09/28',
      monthlyLimit: { amountMinorUnits: 200_000, currency: 'USD' },
      authorizedSpend: { amountMinorUnits: 6_300, currency: 'USD' },
      status: 'active',
      allowedMccs: ['software', 'office_supplies'],
    },
  ],
};

describe('useCards', () => {
  it('returns the wallet on success', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/cards', () => HttpResponse.json(walletBody)));

    const { result } = renderHook(() => useCards(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.cards[0]?.last4).toBe('4021');
  });

  it('surfaces a 403 as a typed CardsForbiddenError', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/cards', () => HttpResponse.json({ error: 'forbidden' }, { status: 403 })),
    );

    const { result } = renderHook(() => useCards(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(CardsForbiddenError);
  });
});
