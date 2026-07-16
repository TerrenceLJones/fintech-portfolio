import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CardTransaction, VirtualCard } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import {
  FeedSocketProvider,
  type FeedSocket,
  type FeedSocketFactory,
} from '@clearline/data-access-cards';
import { GENERIC_DECLINE_MESSAGE } from '@clearline/domain-cards';
import { CardDetailPage } from './CardDetailPage';

const server = registerMswServer();
afterEach(() => clearAccessToken());

/** A hand-driven feed socket the test emits events onto. */
class FakeFeedSocket implements FeedSocket {
  private readonly listeners: Record<string, Array<(event: unknown) => void>> = {};
  addEventListener(type: string, listener: (event: unknown) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }
  close(): void {
    this.fire('close', {});
  }
  emitOpen(): void {
    this.fire('open', {});
  }
  emitMessage(payload: unknown): void {
    this.fire('message', { data: JSON.stringify(payload) });
  }
  private fire(type: string, event: unknown): void {
    for (const listener of this.listeners[type] ?? []) listener(event);
  }
}

function txn(overrides: Partial<CardTransaction> = {}): CardTransaction {
  return {
    id: 'ctxn_1',
    cardId: 'card_4021',
    merchantName: 'Notion Labs',
    merchantInitials: 'No',
    mcc: 'software',
    mccLabel: 'Software',
    amount: { amountMinorUnits: 15_000, currency: 'USD' },
    occurredAt: '2026-07-15T12:00:00.000Z',
    status: 'approved',
    ...overrides,
  };
}

const BASE_CARD: VirtualCard = {
  id: 'card_4021',
  holderName: 'Dara Reyes — Design',
  holderInitials: 'DR',
  last4: '4021',
  exp: '09/28',
  monthlyLimit: { amountMinorUnits: 200_000, currency: 'USD' },
  authorizedSpend: { amountMinorUnits: 15_000, currency: 'USD' },
  status: 'active',
  allowedMccs: ['software', 'office_supplies'],
};

function renderDetail() {
  setAccessToken('access_valid');
  const created: FakeFeedSocket[] = [];
  const factory: FeedSocketFactory = () => {
    const socket = new FakeFeedSocket();
    created.push(socket);
    return socket;
  };

  // Stateful card stub so a freeze POST flips what the subsequent GET returns (AC-05 visual update).
  let frozen = false;
  server.use(
    http.get('*/api/cards/card_4021', () =>
      HttpResponse.json({ card: { ...BASE_CARD, status: frozen ? 'frozen' : 'active' } }),
    ),
    http.post('*/api/cards/card_4021/freeze', async ({ request }) => {
      frozen = ((await request.json()) as { frozen: boolean }).frozen;
      return HttpResponse.json({ card: { ...BASE_CARD, status: frozen ? 'frozen' : 'active' } });
    }),
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        userId: 'user_ctrl',
        email: 'controller@clearline.dev',
        displayName: 'Controller',
        role: 'controller',
        approvalLimit: null,
        isAdmin: false,
        isOwner: false,
      }),
    ),
  );

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <FeedSocketProvider value={factory}>
        <MemoryRouter initialEntries={['/cards/card_4021']}>
          <Routes>
            <Route path="/cards/:cardId" element={<CardDetailPage />} />
          </Routes>
        </MemoryRouter>
      </FeedSocketProvider>
    </QueryClientProvider>,
  );
  return { created };
}

describe('CardDetailPage (US-CW-014)', () => {
  it('shows the card and its derived, read-only remaining limit (AC-02)', async () => {
    renderDetail();
    expect(await screen.findByText('Dara Reyes — Design')).toBeInTheDocument();
    // $2,000 − $150 = $1,850 remaining, derived.
    expect(screen.getAllByText('$1,850.00').length).toBeGreaterThanOrEqual(1);
    // The remaining figure is marked derived / read-only so it never reads as editable.
    expect(screen.getAllByText(/DERIVED/i).length).toBeGreaterThanOrEqual(1);
  });

  it('streams a live authorization into the feed (AC-02)', async () => {
    const { created } = renderDetail();
    await screen.findByText('Dara Reyes — Design');
    const socket = created[0]!;
    act(() => socket.emitOpen());
    act(() => socket.emitMessage({ type: 'transaction', transaction: txn() }));
    expect(await screen.findByText('Notion Labs')).toBeInTheDocument();
  });

  it('shows an MCC decline with its feed reason and a specific cardholder message (AC-03)', async () => {
    const { created } = renderDetail();
    await screen.findByText('Dara Reyes — Design');
    const socket = created[0]!;
    act(() => socket.emitOpen());
    act(() =>
      socket.emitMessage({
        type: 'transaction',
        transaction: txn({
          id: 'ctxn_grill',
          merchantName: 'Vista Grill',
          mcc: 'restaurants',
          mccLabel: 'Restaurants',
          amount: { amountMinorUnits: 6_400, currency: 'USD' },
          status: 'declined',
          declineReason: 'mcc_restricted',
        }),
      }),
    );
    expect(await screen.findByText('Declined · MCC restricted (Restaurants)')).toBeInTheDocument();
    expect(
      screen.getByText("Transaction declined — this card can't be used at this type of merchant"),
    ).toBeInTheDocument();
  });

  it('never reveals a lost/stolen reason — the cardholder sees only the generic message (AC-07)', async () => {
    const { created } = renderDetail();
    await screen.findByText('Dara Reyes — Design');
    const socket = created[0]!;
    act(() => socket.emitOpen());
    act(() =>
      socket.emitMessage({
        type: 'transaction',
        transaction: txn({
          id: 'ctxn_lost',
          merchantName: 'Best Buy',
          status: 'declined',
          declineReason: 'lost_or_stolen',
        }),
      }),
    );
    expect(await screen.findByText(GENERIC_DECLINE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/lost|stolen/i)).not.toBeInTheDocument();
  });

  it('shows a "Reconnecting…" banner but keeps prior transactions visible when the feed drops (AC-06)', async () => {
    const { created } = renderDetail();
    await screen.findByText('Dara Reyes — Design');
    const socket = created[0]!;
    act(() => socket.emitOpen());
    act(() =>
      socket.emitMessage({
        type: 'backlog',
        transactions: [txn({ id: 'ctxn_aws', merchantName: 'Amazon Web Services' })],
      }),
    );
    expect(await screen.findByText('Amazon Web Services')).toBeInTheDocument();

    act(() => socket.close());
    expect(await screen.findByText('Reconnecting…')).toBeInTheDocument();
    // Prior data stays on screen.
    expect(screen.getByText('Amazon Web Services')).toBeInTheDocument();
    expect(screen.getByText(/last-known transactions/i)).toBeInTheDocument();
  });

  it('freezes the card and updates its visual state to a "Frozen" badge (AC-05)', async () => {
    const user = userEvent.setup();
    renderDetail();
    const freezeButton = await screen.findByRole('button', { name: /Freeze card/ });
    await user.click(freezeButton);
    // The card face's inline "Frozen" pill appears once the refetched card reflects the freeze.
    expect(await screen.findByText('Frozen')).toBeInTheDocument();
  });
});
