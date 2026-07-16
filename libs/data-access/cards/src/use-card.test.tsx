import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { CardResponse } from '@clearline/contracts';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { useCard, CardNotFoundError } from './use-card';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

const cardBody: CardResponse = {
  card: {
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
};

describe('useCard', () => {
  it('fetches a single card by id', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/cards/card_4021', () => HttpResponse.json(cardBody)));

    const { result } = renderHook(() => useCard('card_4021'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.card.holderName).toBe('Dara Reyes — Design');
  });

  it('surfaces a 404 as a typed CardNotFoundError', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/cards/card_nope', () =>
        HttpResponse.json({ error: 'card_not_found' }, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useCard('card_nope'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(CardNotFoundError);
  });

  it('does not fetch when disabled', () => {
    setAccessToken('access_valid');
    const { result } = renderHook(() => useCard('card_4021', { enabled: false }), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
