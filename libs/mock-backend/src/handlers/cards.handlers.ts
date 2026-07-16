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
import { AuthService } from '../services/auth.service';
import { CardsService, type CardActor } from '../services/cards.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedCardsService } from '../services/shared-cards-service';

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
    permissions: permissionsForRole(session.role!, { isAdmin: session.isAdmin! }),
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
): HttpHandler[] {
  return [
    // The issuance form's data is Controller-only (cards:manage) — declared before the parameterized
    // `/api/cards/:cardId` GET so 'context' isn't swallowed as a card id.
    http.get('*/api/cards/context', ({ request }) => {
      const gate = requirePermission(request, authService, 'cards:manage');
      if ('error' in gate) return gate.error;
      const body: IssueCardContextResponse = cardsService.getIssueContext();
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
      const result = cardsService.issueCard(payload, gate.actor);
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
