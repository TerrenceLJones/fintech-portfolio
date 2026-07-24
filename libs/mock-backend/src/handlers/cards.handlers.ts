import { http, HttpResponse, ws, type HttpHandler, type WebSocketHandler } from 'msw';
import type {
  CardErrorResponse,
  CardFeedMessage,
  CardListResponse,
  CardResponse,
  FreezeCardRequest,
  IssueCardContextResponse,
  IssueCardRequest,
  Permission,
  SessionErrorResponse,
} from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import { CARD_CURRENCY } from '../fixtures/cards.fixture';
import { AuthService } from '../services/auth.service';
import { CardsService, type CardActor } from '../services/cards.service';
import { AuditService } from '../services/audit.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedCardsService } from '../services/shared-cards-service';
import { sharedAuditService } from '../services/shared-audit-service';
import { formatAuditMoney, resolveAuditActor } from './audit-actor';
import { OnboardingTasksService } from '../services/onboarding-tasks.service';
import { sharedOnboardingTasksService } from '../services/shared-onboarding-tasks-service';

/**
 * Resolves the acting user from the request's own access token — never from anything the client
 * claims. Permissions are derived server-side from the resolved role, so `cards:manage` is re-checked
 * here regardless of what the UI rendered (US-CW-014: the client is never the boundary).
 */
function resolveActor(request: Request, authService: AuthService): CardActor | null {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!accessToken) return null;

  const session = authService.checkSession(accessToken);
  if (session.outcome !== 'active') return null;

  return {
    userId: session.userId!,
    displayName: session.displayName!,
    permissions: permissionsForRole(session.role!, {
      isAdmin: session.isAdmin!,
      isOwner: session.isOwner!,
    }),
  };
}

const unauthorized = () =>
  HttpResponse.json({ error: 'invalid_token' } satisfies SessionErrorResponse, { status: 401 });

const forbidden = () =>
  HttpResponse.json({ error: 'forbidden' } satisfies CardErrorResponse, { status: 403 });

function requirePermission(
  request: Request,
  authService: AuthService,
  permission: Permission,
): { actor: CardActor } | { error: Response } {
  const actor = resolveActor(request, authService);
  if (!actor) return { error: unauthorized() };
  if (!hasPermission(actor.permissions, permission)) return { error: forbidden() };
  return { actor };
}

/** Thin HTTP adapter in front of CardsService — the guardrails live in the service + @clearline/domain-cards. */
export function createCardsHandlers(
  cardsService: CardsService = sharedCardsService,
  authService: AuthService = sharedAuthService,
  auditService: AuditService = sharedAuditService,
  onboardingTasksService: OnboardingTasksService = sharedOnboardingTasksService,
): HttpHandler[] {
  return [
    // The issuance form's data is Controller-only (cards:manage) — declared before the parameterized
    // `/api/cards/:cardId` GET so 'context' isn't swallowed as a card id.
    http.get('*/api/cards/context', ({ request }) => {
      const gate = requirePermission(request, authService, 'cards:manage');
      if ('error' in gate) return gate.error;
      // Merge in the org's Card Program defaults so the issuance form prefills them — new cards start
      // with the org's default limits and MCC restrictions (US-CW-038 AC-01).
      const orgId = authService.getOrgIdForUser(gate.actor.userId);
      const defaults = orgId ? authService.getCardProgramDefaults(orgId) : null;
      const body: IssueCardContextResponse = {
        ...cardsService.getIssueContext(),
        ...(defaults
          ? {
              defaultMonthlyLimit: {
                amountMinorUnits: defaults.defaultMonthlyLimitMinorUnits,
                currency: CARD_CURRENCY,
              },
              defaultPerTransactionLimit: {
                amountMinorUnits: defaults.defaultPerTransactionLimitMinorUnits,
                currency: CARD_CURRENCY,
              },
              defaultAllowedMccs: defaults.defaultAllowedMccs,
            }
          : {}),
      };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/cards', ({ request }) => {
      const gate = requirePermission(request, authService, 'cards:view');
      if ('error' in gate) return gate.error;
      const body: CardListResponse = { cards: cardsService.listCards() };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/cards', async ({ request }) => {
      const gate = requirePermission(request, authService, 'cards:manage');
      if ('error' in gate) return gate.error;

      const payload = (await request.json()) as IssueCardRequest;
      // Seed the per-transaction ceiling from the org's Card Program default when the form omits it, so a
      // newly issued card carries the org default (US-CW-038 AC-01).
      const orgId = authService.getOrgIdForUser(gate.actor.userId);
      const defaults = orgId ? authService.getCardProgramDefaults(orgId) : null;
      const seeded: IssueCardRequest = {
        ...payload,
        ...(payload.perTransactionLimit || !defaults
          ? {}
          : {
              perTransactionLimit: {
                amountMinorUnits: defaults.defaultPerTransactionLimitMinorUnits,
                currency: CARD_CURRENCY,
              },
            }),
      };
      const result = cardsService.issueCard(seeded, gate.actor);
      if (result.outcome === 'forbidden') return forbidden();
      if (result.outcome === 'invalid_limit') {
        return HttpResponse.json({ error: 'invalid_limit' } satisfies CardErrorResponse, {
          status: 422,
        });
      }
      if (result.outcome === 'invalid_holder') {
        return HttpResponse.json({ error: 'invalid_holder' } satisfies CardErrorResponse, {
          status: 422,
        });
      }
      // Card issuance is a privileged card-control action — record it with its limit + MCC posture in
      // the central audit log (US-CW-021 AC-03). The actor is re-resolved from the session so the log
      // carries their role, not just the CardActor's id/name.
      const auditActor = resolveAuditActor(request, authService);
      if (auditActor) {
        const mccCount = result.card.allowedMccs.length;
        auditService.record({
          actor: auditActor,
          category: 'card_control',
          action: 'Issued card',
          target: { label: `•••• ${result.card.last4}`, ref: result.card.id },
          detail: `${formatAuditMoney(result.card.monthlyLimit)}/mo · ${
            mccCount > 0
              ? `${mccCount} MCC restriction${mccCount === 1 ? '' : 's'}`
              : 'unrestricted'
          }`,
        });
      }
      // Issuing a card completes the Controller's signature getting-started task (US-CW-047).
      onboardingTasksService.markComplete(gate.actor.userId, 'issue-card');
      const body: CardResponse = { card: result.card };
      return HttpResponse.json(body, { status: 201 });
    }),

    http.post('*/api/cards/:cardId/freeze', async ({ request, params }) => {
      const gate = requirePermission(request, authService, 'cards:manage');
      if ('error' in gate) return gate.error;

      const { frozen } = (await request.json()) as FreezeCardRequest;
      const result = cardsService.setFreeze(String(params.cardId), frozen, gate.actor);
      if (result.outcome === 'forbidden') return forbidden();
      if (result.outcome === 'not_found') {
        return HttpResponse.json({ error: 'card_not_found' } satisfies CardErrorResponse, {
          status: 404,
        });
      }
      // A freeze/unfreeze is an auditable card-control change with a clear before → after (US-CW-021
      // AC-03): the log captures the prior and new state, who made the change, and when.
      const auditActor = resolveAuditActor(request, authService);
      if (auditActor) {
        auditService.record({
          actor: auditActor,
          category: 'card_control',
          action: frozen ? 'Froze card' : 'Unfroze card',
          target: { label: `•••• ${result.card.last4}`, ref: result.card.id },
          diff: frozen
            ? { from: 'Active', to: 'Frozen', tone: 'neutral' }
            : { from: 'Frozen', to: 'Active', tone: 'positive' },
        });
      }
      const body: CardResponse = { card: result.card };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/cards/:cardId', ({ request, params }) => {
      const gate = requirePermission(request, authService, 'cards:view');
      if ('error' in gate) return gate.error;

      const card = cardsService.getCard(String(params.cardId));
      if (!card) {
        return HttpResponse.json({ error: 'card_not_found' } satisfies CardErrorResponse, {
          status: 404,
        });
      }
      const body: CardResponse = { card };
      return HttpResponse.json(body, { status: 200 });
    }),
  ];
}

/** The WebSocket link for the real-time transaction feed (US-CW-014 AC-02/AC-06). */
const cardFeedLink = ws.link('*/api/cards/feed');

/**
 * The card feed WebSocket handler. On connect it replays the card's known transactions as a `backlog`
 * message, then subscribes the socket to the shared service so every subsequent authorization streams
 * live. The service's disposer is wired to the socket's close so a dropped client stops receiving —
 * and `sharedCardsService.dropFeed(cardId)` closes the socket to trigger the client's reconnect (AC-06).
 * The card id travels as a `?cardId=` query param since a browser can't set custom WS headers.
 */
export function createCardsFeedHandler(
  cardsService: CardsService = sharedCardsService,
): WebSocketHandler {
  return cardFeedLink.addEventListener('connection', ({ client }) => {
    const cardId = client.url.searchParams.get('cardId') ?? '';
    const backlog: CardFeedMessage = {
      type: 'backlog',
      transactions: cardsService.getBacklog(cardId),
    };
    client.send(JSON.stringify(backlog));

    const off = cardsService.connectFeed(cardId, {
      send: (message) => client.send(JSON.stringify(message)),
      close: () => client.close(),
    });
    client.addEventListener('close', off);
  });
}

export const cardsHandlers = createCardsHandlers();
export const cardsFeedHandler = createCardsFeedHandler();
