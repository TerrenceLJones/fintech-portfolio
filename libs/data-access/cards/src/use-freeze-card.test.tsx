import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { CardResponse } from '@clearline/contracts';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { useFreezeCard, CardFreezeError } from './use-freeze-card';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

afterEach(() => clearAccessToken());

const frozenBody: CardResponse = {
  card: {
    id: 'card_4021',
    holderName: 'Dara Reyes — Design',
    holderInitials: 'DR',
    last4: '4021',
    exp: '09/28',
    monthlyLimit: { amountMinorUnits: 200_000, currency: 'USD' },
    authorizedSpend: { amountMinorUnits: 6_300, currency: 'USD' },
    status: 'frozen',
    allowedMccs: ['software', 'office_supplies'],
  },
};

describe('useFreezeCard', () => {
  it('freezes a card and returns its updated state', async () => {
    setAccessToken('access_valid');
    server.use(http.post('*/api/cards/card_4021/freeze', () => HttpResponse.json(frozenBody)));

    const { result } = renderHook(() => useFreezeCard(), { wrapper });
    result.current.mutate({ cardId: 'card_4021', frozen: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.card.status).toBe('frozen');
  });

  it('maps a 404 to a typed CardFreezeError', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/cards/card_nope/freeze', () =>
        HttpResponse.json({ error: 'card_not_found' }, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useFreezeCard(), { wrapper });
    result.current.mutate({ cardId: 'card_nope', frozen: true });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(CardFreezeError);
  });
});
