import type {
  CardDeclineReason,
  CardFeedMessage,
  CardTransaction,
  CardholderCandidate,
  IssueCardContextResponse,
  IssueCardRequest,
  MerchantCategory,
  Money,
  Permission,
  VirtualCard,
} from '@clearline/contracts';
import { hasPermission } from '@clearline/domain-auth';
import { authorizeCardTransaction } from '@clearline/domain-cards';
import {
  CARD_CURRENCY,
  SEED_CARDHOLDER_CANDIDATES,
  SEED_CARDS,
  SEED_CARD_TRANSACTIONS,
  SEED_MERCHANT_CATEGORIES,
  type SeedCard,
  type SeedCardTransaction,
} from '../fixtures/cards.fixture';

/** The resolved caller — permissions come from the session (see cards.handlers), never client claims. */
export interface CardActor {
  userId: string;
  displayName: string;
  permissions: readonly Permission[];
}

/**
 * An append-only audit record of a privileged card action (US-CW-014 AC-01/AC-05). Card issuance
 * captures the limit + MCC restrictions; a freeze/unfreeze captures who and when. The relevant
 * parameters are kept as flat scalars so a reader (or the future audit-log page) needs no card lookup.
 */
export interface CardAuditEvent {
  id: string;
  type: 'card.issued' | 'card.frozen' | 'card.unfrozen';
  cardId: string;
  actorId: string;
  timestamp: string;
  monthlyLimitMinorUnits?: number;
  allowedMccs?: string[];
}

/** A live feed connection — the ws handler's adapter over one client socket (US-CW-014 AC-02). */
export interface CardFeedConnection {
  send: (message: CardFeedMessage) => void;
  close: () => void;
}

export type IssueCardOutcome =
  | { outcome: 'ok'; card: VirtualCard }
  | { outcome: 'forbidden' }
  | { outcome: 'invalid_limit' }
  | { outcome: 'invalid_holder' };

export type FreezeCardOutcome =
  { outcome: 'ok'; card: VirtualCard } | { outcome: 'forbidden' } | { outcome: 'not_found' };

/** An authorization attempt — the merchant/amount details plus an optional reported security hold. */
export interface AuthorizeTransactionInput {
  merchantName: string;
  merchantInitials: string;
  mcc: string;
  mccLabel: string;
  amountMinorUnits: number;
  /** Set to model a card reported lost/stolen/fraudulent — overrides every ordinary check (AC-07). */
  securityHold?: Extract<CardDeclineReason, 'lost_or_stolen' | 'fraud'>;
}

export type AuthorizeTransactionOutcome =
  | { outcome: 'approved'; transaction: CardTransaction }
  | { outcome: 'declined'; transaction: CardTransaction }
  | { outcome: 'not_found' };

interface StoredCard {
  id: string;
  holderId: string;
  holderName: string;
  holderInitials: string;
  last4: string;
  exp: string;
  monthlyLimitMinorUnits: number;
  authorizedSpendMinorUnits: number;
  frozen: boolean;
  allowedMccs: string[];
}

interface CardsSeed {
  cards?: SeedCard[];
  transactions?: SeedCardTransaction[];
  candidates?: CardholderCandidate[];
  merchantCategories?: MerchantCategory[];
  /** Overridable clock (epoch ms) so tests get deterministic timestamps/ids. */
  clock?: () => number;
}

/**
 * In-memory virtual-card backend with server-authoritative guardrails (US-CW-014). Every authorization
 * runs through @clearline/domain-cards' `authorizeCardTransaction` — the same gate the client uses —
 * so a freeze, MCC restriction, or limit is enforced here regardless of the UI. The remaining limit is
 * always DERIVED (monthlyLimit − authorizedSpend) and never stored, so displayed and actual headroom
 * can't drift. Issuance and freeze emit audit events; approved authorizations stream to any connected
 * feed. State is per-instance; the app binds to the shared singleton (see shared-cards-service).
 */
export class CardsService {
  private readonly cards = new Map<string, StoredCard>();
  private readonly transactions = new Map<string, CardTransaction[]>();
  private readonly candidates: CardholderCandidate[];
  private readonly merchantCategories: MerchantCategory[];
  private readonly auditLog: CardAuditEvent[] = [];
  private readonly connections = new Map<string, Set<CardFeedConnection>>();
  private readonly clock: () => number;
  private counter = 0;

  constructor(seed: CardsSeed = {}) {
    this.clock = seed.clock ?? (() => Date.now());
    this.candidates = (seed.candidates ?? SEED_CARDHOLDER_CANDIDATES).map((c) => ({ ...c }));
    this.merchantCategories = (seed.merchantCategories ?? SEED_MERCHANT_CATEGORIES).map((m) => ({
      ...m,
    }));

    for (const card of seed.cards ?? SEED_CARDS) {
      this.cards.set(card.id, {
        id: card.id,
        holderId: card.holderId,
        holderName: card.holderName,
        holderInitials: card.holderInitials,
        last4: card.last4,
        exp: card.exp,
        monthlyLimitMinorUnits: card.monthlyLimitMinorUnits,
        authorizedSpendMinorUnits: card.authorizedSpendMinorUnits,
        frozen: card.status === 'frozen',
        allowedMccs: [...card.allowedMccs],
      });
    }
    for (const txn of seed.transactions ?? SEED_CARD_TRANSACTIONS) {
      const list = this.transactions.get(txn.cardId) ?? [];
      list.push({
        id: txn.id,
        cardId: txn.cardId,
        merchantName: txn.merchantName,
        merchantInitials: txn.merchantInitials,
        mcc: txn.mcc,
        mccLabel: txn.mccLabel,
        amount: this.money(txn.amountMinorUnits),
        occurredAt: txn.occurredAt,
        status: txn.status,
      });
      this.transactions.set(txn.cardId, list);
    }
  }

  listCards(): VirtualCard[] {
    return [...this.cards.values()].map((card) => this.toWireCard(card));
  }

  getCard(id: string): VirtualCard | undefined {
    const card = this.cards.get(id);
    return card ? this.toWireCard(card) : undefined;
  }

  getIssueContext(): IssueCardContextResponse {
    return {
      candidates: this.candidates.map((c) => ({ ...c })),
      merchantCategories: this.merchantCategories.map((m) => ({ ...m })),
    };
  }

  getBacklog(cardId: string): CardTransaction[] {
    return (this.transactions.get(cardId) ?? []).map((t) => ({ ...t, amount: { ...t.amount } }));
  }

  getAuditLog(): readonly CardAuditEvent[] {
    return this.auditLog.map((e) => ({ ...e }));
  }

  issueCard(request: IssueCardRequest, actor: CardActor): IssueCardOutcome {
    if (!hasPermission(actor.permissions, 'cards:manage')) return { outcome: 'forbidden' };
    if (
      !Number.isInteger(request.monthlyLimit.amountMinorUnits) ||
      request.monthlyLimit.amountMinorUnits <= 0
    ) {
      return { outcome: 'invalid_limit' };
    }
    const holder = this.candidates.find((c) => c.id === request.holderId);
    if (!holder) return { outcome: 'invalid_holder' };

    const id = this.nextId('card');
    const stored: StoredCard = {
      id,
      holderId: holder.id,
      holderName: `${holder.name} — ${holder.team}`,
      holderInitials: holder.initials,
      last4: this.mintLast4(),
      exp: '09/28',
      monthlyLimitMinorUnits: request.monthlyLimit.amountMinorUnits,
      authorizedSpendMinorUnits: 0,
      frozen: false,
      allowedMccs: [...request.allowedMccs],
    };
    this.cards.set(id, stored);
    this.transactions.set(id, []);
    this.auditLog.push({
      id: this.nextId('cevt'),
      type: 'card.issued',
      cardId: id,
      actorId: actor.userId,
      timestamp: this.nowIso(),
      monthlyLimitMinorUnits: stored.monthlyLimitMinorUnits,
      allowedMccs: [...stored.allowedMccs],
    });
    return { outcome: 'ok', card: this.toWireCard(stored) };
  }

  setFreeze(cardId: string, frozen: boolean, actor: CardActor): FreezeCardOutcome {
    if (!hasPermission(actor.permissions, 'cards:manage')) return { outcome: 'forbidden' };
    const card = this.cards.get(cardId);
    if (!card) return { outcome: 'not_found' };

    card.frozen = frozen;
    this.auditLog.push({
      id: this.nextId('cevt'),
      type: frozen ? 'card.frozen' : 'card.unfrozen',
      cardId,
      actorId: actor.userId,
      timestamp: this.nowIso(),
    });
    return { outcome: 'ok', card: this.toWireCard(card) };
  }

  /**
   * Runs an authorization through the domain gate and records it on the feed. An approval debits the
   * card's authorized spend (moving the derived remaining limit) and streams to subscribers; a decline
   * carries its true reason and moves nothing (US-CW-014 AC-02/03/04/05/07). The true reason is stored
   * for audit — the cardholder-facing message is gated separately in the UI (AC-07).
   */
  authorizeTransaction(
    cardId: string,
    input: AuthorizeTransactionInput,
  ): AuthorizeTransactionOutcome {
    const card = this.cards.get(cardId);
    if (!card) return { outcome: 'not_found' };

    const decision = authorizeCardTransaction({
      frozen: card.frozen,
      allowedMccs: card.allowedMccs,
      transactionMcc: input.mcc,
      monthlyLimitMinorUnits: card.monthlyLimitMinorUnits,
      authorizedSpendMinorUnits: card.authorizedSpendMinorUnits,
      amountMinorUnits: input.amountMinorUnits,
      ...(input.securityHold ? { securityHold: input.securityHold } : {}),
    });

    const transaction: CardTransaction = {
      id: this.nextId('ctxn'),
      cardId,
      merchantName: input.merchantName,
      merchantInitials: input.merchantInitials,
      mcc: input.mcc,
      mccLabel: input.mccLabel,
      amount: this.money(input.amountMinorUnits),
      occurredAt: this.nowIso(),
      status: decision.approved ? 'approved' : 'declined',
      ...(decision.approved ? {} : { declineReason: decision.reason }),
    };

    if (decision.approved) {
      card.authorizedSpendMinorUnits += input.amountMinorUnits;
    }
    const list = this.transactions.get(cardId) ?? [];
    list.push(transaction);
    this.transactions.set(cardId, list);
    this.emit(cardId, { type: 'transaction', transaction: { ...transaction } });

    return decision.approved
      ? { outcome: 'approved', transaction }
      : { outcome: 'declined', transaction };
  }

  /**
   * Subscribes a live feed connection to a card and returns an unsubscribe. Used by the ws handler on
   * connect; the returned disposer is wired to the socket's close so a dropped client stops receiving.
   */
  connectFeed(cardId: string, connection: CardFeedConnection): () => void {
    const set = this.connections.get(cardId) ?? new Set<CardFeedConnection>();
    set.add(connection);
    this.connections.set(cardId, set);
    return () => set.delete(connection);
  }

  /** Force-closes every open feed connection for a card — the demo's WebSocket-drop trigger (AC-06). */
  dropFeed(cardId: string): void {
    for (const connection of this.connections.get(cardId) ?? []) {
      connection.close();
    }
  }

  private emit(cardId: string, message: CardFeedMessage): void {
    for (const connection of this.connections.get(cardId) ?? []) {
      connection.send(message);
    }
  }

  private toWireCard(card: StoredCard): VirtualCard {
    return {
      id: card.id,
      holderName: card.holderName,
      holderInitials: card.holderInitials,
      last4: card.last4,
      exp: card.exp,
      monthlyLimit: this.money(card.monthlyLimitMinorUnits),
      authorizedSpend: this.money(card.authorizedSpendMinorUnits),
      status: card.frozen ? 'frozen' : 'active',
      allowedMccs: [...card.allowedMccs],
    };
  }

  private money(amountMinorUnits: number): Money {
    return { amountMinorUnits, currency: CARD_CURRENCY };
  }

  private mintLast4(): string {
    // Deterministic 4-digit tail derived from the counter, so issued cards get distinct visible PANs.
    return String(4000 + (this.counter % 6000)).padStart(4, '0');
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_${this.counter}`;
  }

  private nowIso(): string {
    return new Date(this.clock()).toISOString();
  }
}
