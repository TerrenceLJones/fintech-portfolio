import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { CardFeedMessage, CardTransaction } from '@clearline/contracts';
import { feedBackoffDelay } from '@clearline/domain-cards';

/** The connection lifecycle the UI reflects: initial connect, live, or dropped-and-retrying (AC-06). */
export type FeedConnectionState = 'connecting' | 'open' | 'reconnecting';

/**
 * The minimal socket surface the feed hook needs — a seam so production uses a native `WebSocket` and
 * tests inject a hand-driven fake. The native `WebSocket` satisfies this shape directly.
 */
export interface FeedSocket {
  addEventListener(
    type: 'open' | 'message' | 'close' | 'error',
    listener: (event: unknown) => void,
  ): void;
  close(): void;
}

export type FeedSocketFactory = (url: string) => FeedSocket;

/** Opens a real browser WebSocket to the feed endpoint — the default transport outside tests. */
const nativeFeedSocketFactory: FeedSocketFactory = (url) =>
  new WebSocket(url) as unknown as FeedSocket;

const FeedSocketContext = createContext<FeedSocketFactory>(nativeFeedSocketFactory);

/** Overrides the feed transport for a subtree — production leaves it as the native WebSocket; tests inject a fake. */
export const FeedSocketProvider = FeedSocketContext.Provider;

/** Builds the absolute ws(s):// URL for a card's feed from the current origin (the MSW ws link matches it). */
function buildFeedUrl(cardId: string): string {
  const scheme = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss' : 'ws';
  const host = typeof location !== 'undefined' ? location.host : 'localhost';
  return `${scheme}://${host}/api/cards/feed?cardId=${encodeURIComponent(cardId)}`;
}

export interface UseTransactionFeedOptions {
  enabled?: boolean;
  /** Override the socket transport (tests inject a fake); defaults to the FeedSocketProvider value. */
  createSocket?: FeedSocketFactory;
  /** Override the reconnect backoff (tests); production uses feedBackoffDelay. */
  backoffMs?: (attempt: number) => number;
}

export interface TransactionFeedState {
  transactions: CardTransaction[];
  connectionState: FeedConnectionState;
  /** Seconds until the next reconnect attempt while reconnecting — drives the "retry in Ns" copy. */
  retryDelaySeconds: number;
}

/**
 * Subscribes to a card's real-time transaction feed over a WebSocket (US-CW-014 AC-02/AC-06). On
 * connect the server replays a `backlog` message the hook hydrates from; each subsequent `transaction`
 * message appends live. If the socket drops, the hook enters `reconnecting` — keeping the
 * already-loaded transactions on screen (they're stale, not gone) — and reconnects with exponential
 * backoff (`feedBackoffDelay`), exposing the pending delay so the UI can count it down. Unmounting
 * closes the socket and cancels any scheduled reconnect.
 */
export function useTransactionFeed(
  cardId: string,
  options: UseTransactionFeedOptions = {},
): TransactionFeedState {
  const contextFactory = useContext(FeedSocketContext);
  const enabled = options.enabled ?? true;

  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [connectionState, setConnectionState] = useState<FeedConnectionState>('connecting');
  const [retryDelaySeconds, setRetryDelaySeconds] = useState(0);

  // Hold the transport + backoff in refs so a changing option identity doesn't tear down the socket.
  const createSocketRef = useRef<FeedSocketFactory>(nativeFeedSocketFactory);
  createSocketRef.current = options.createSocket ?? contextFactory;
  const backoffRef = useRef<(attempt: number) => number>(feedBackoffDelay);
  backoffRef.current = options.backoffMs ?? feedBackoffDelay;

  useEffect(() => {
    if (!enabled || !cardId) return;

    let attempt = 0;
    let socket: FeedSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const handleMessage = (raw: string) => {
      let message: CardFeedMessage;
      try {
        message = JSON.parse(raw) as CardFeedMessage;
      } catch {
        return;
      }
      if (message.type === 'backlog') {
        setTransactions(message.transactions);
      } else if (message.type === 'transaction') {
        setTransactions((prev) => [...prev, message.transaction]);
      }
    };

    const scheduleReconnect = () => {
      const delay = backoffRef.current(attempt);
      attempt += 1;
      setConnectionState('reconnecting');
      setRetryDelaySeconds(Math.ceil(delay / 1000));
      reconnectTimer = setTimeout(connect, delay);
    };

    function connect() {
      if (disposed) return;
      setConnectionState(attempt === 0 ? 'connecting' : 'reconnecting');
      const nextSocket = createSocketRef.current(buildFeedUrl(cardId));
      socket = nextSocket;

      nextSocket.addEventListener('open', () => {
        if (disposed) return;
        attempt = 0;
        setRetryDelaySeconds(0);
        setConnectionState('open');
      });
      nextSocket.addEventListener('message', (event) => {
        if (disposed) return;
        const data = (event as { data?: unknown }).data;
        handleMessage(typeof data === 'string' ? data : String(data));
      });
      nextSocket.addEventListener('close', () => {
        if (disposed) return;
        scheduleReconnect();
      });
      nextSocket.addEventListener('error', () => {
        // Some sockets fire error without a following close; funnel both through close→reconnect.
        nextSocket.close();
      });
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
    // Reconnect only when the card or enabled flag changes — transport/backoff live in refs.
  }, [cardId, enabled]);

  return { transactions, connectionState, retryDelaySeconds };
}
