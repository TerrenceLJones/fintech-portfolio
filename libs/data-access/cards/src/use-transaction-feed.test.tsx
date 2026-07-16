import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { CardTransaction } from '@clearline/contracts';
import {
  useTransactionFeed,
  type FeedSocket,
  type FeedSocketFactory,
} from './use-transaction-feed';

/** A hand-driven socket so tests deterministically fire open/message/close without a real WebSocket. */
class FakeFeedSocket implements FeedSocket {
  private readonly listeners: Record<string, Array<(event: unknown) => void>> = {};
  closed = false;

  addEventListener(type: string, listener: (event: unknown) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }
  close(): void {
    this.closed = true;
  }

  emitOpen(): void {
    this.fire('open', {});
  }
  emitMessage(payload: unknown): void {
    this.fire('message', { data: JSON.stringify(payload) });
  }
  emitClose(): void {
    this.fire('close', {});
  }

  private fire(type: string, event: unknown): void {
    for (const listener of this.listeners[type] ?? []) listener(event);
  }
}

function trackingFactory(): { created: FakeFeedSocket[]; create: FeedSocketFactory } {
  const created: FakeFeedSocket[] = [];
  return {
    created,
    create: () => {
      const socket = new FakeFeedSocket();
      created.push(socket);
      return socket;
    },
  };
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

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useTransactionFeed', () => {
  it('starts connecting and moves to open when the socket opens', () => {
    const { created, create } = trackingFactory();
    const { result } = renderHook(() => useTransactionFeed('card_4021', { createSocket: create }));
    expect(result.current.connectionState).toBe('connecting');

    act(() => created[0]!.emitOpen());
    expect(result.current.connectionState).toBe('open');
  });

  it('hydrates from a backlog message and appends live transactions (AC-02)', () => {
    const { created, create } = trackingFactory();
    const { result } = renderHook(() => useTransactionFeed('card_4021', { createSocket: create }));
    act(() => created[0]!.emitOpen());

    act(() =>
      created[0]!.emitMessage({ type: 'backlog', transactions: [txn({ id: 'ctxn_aws' })] }),
    );
    expect(result.current.transactions).toHaveLength(1);

    act(() =>
      created[0]!.emitMessage({ type: 'transaction', transaction: txn({ id: 'ctxn_notion' }) }),
    );
    expect(result.current.transactions.map((t) => t.id)).toEqual(['ctxn_aws', 'ctxn_notion']);
  });

  it('enters "reconnecting" on a dropped connection while keeping prior transactions visible (AC-06)', () => {
    const { created, create } = trackingFactory();
    const { result } = renderHook(() => useTransactionFeed('card_4021', { createSocket: create }));
    act(() => created[0]!.emitOpen());
    act(() => created[0]!.emitMessage({ type: 'backlog', transactions: [txn()] }));

    act(() => created[0]!.emitClose());
    expect(result.current.connectionState).toBe('reconnecting');
    // Prior data stays on screen — it's just no longer implied to be complete.
    expect(result.current.transactions).toHaveLength(1);
    // First retry waits the 1s base backoff.
    expect(result.current.retryDelaySeconds).toBe(1);
  });

  it('reconnects with exponential backoff and recovers to open (AC-06)', () => {
    const { created, create } = trackingFactory();
    const { result } = renderHook(() => useTransactionFeed('card_4021', { createSocket: create }));
    act(() => created[0]!.emitOpen());

    // First drop → 1s backoff.
    act(() => created[0]!.emitClose());
    expect(result.current.retryDelaySeconds).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(created).toHaveLength(2);

    // Second drop (still down) → 2s backoff.
    act(() => created[1]!.emitClose());
    expect(result.current.retryDelaySeconds).toBe(2);
    act(() => vi.advanceTimersByTime(2000));
    expect(created).toHaveLength(3);

    // Recovery resets the state.
    act(() => created[2]!.emitOpen());
    expect(result.current.connectionState).toBe('open');
    expect(result.current.retryDelaySeconds).toBe(0);
  });

  it('closes the socket and cancels any pending reconnect on unmount', () => {
    const { created, create } = trackingFactory();
    const { result, unmount } = renderHook(() =>
      useTransactionFeed('card_4021', { createSocket: create }),
    );
    act(() => created[0]!.emitOpen());
    act(() => created[0]!.emitClose()); // schedules a reconnect
    expect(result.current.connectionState).toBe('reconnecting');

    unmount();
    expect(created[0]!.closed).toBe(true);
    act(() => vi.advanceTimersByTime(5000));
    // No new socket opened after unmount.
    expect(created).toHaveLength(1);
  });

  it('does not connect when disabled', () => {
    const { created, create } = trackingFactory();
    renderHook(() => useTransactionFeed('card_4021', { createSocket: create, enabled: false }));
    expect(created).toHaveLength(0);
  });
});
