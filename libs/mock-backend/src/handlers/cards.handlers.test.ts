import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { CardListResponse, CardResponse, IssueCardRequest } from '@clearline/contracts';
import { createCardsHandlers } from './cards.handlers';
import { AuthService } from '../services/auth.service';
import { CardsService } from '../services/cards.service';
import { SEED_USERS, DEMO_USER_PASSWORD } from '../fixtures/users.fixture';

const IP = '127.0.0.1 (mocked)';
const ORIGIN = 'http://cards-test.example';

const controller = SEED_USERS.find((u) => u.role === 'controller')!;
const employee = SEED_USERS.find((u) => u.role === 'employee')!;

let authService: AuthService;
let cardsService: CardsService;
let server: ReturnType<typeof setupServer>;

beforeAll(() => {
  server = setupServer();
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  authService = new AuthService();
  cardsService = new CardsService();
  server.use(...createCardsHandlers(cardsService, authService));
});

async function login(email: string): Promise<string> {
  const { accessToken } = await authService.login(email, DEMO_USER_PASSWORD, IP);
  return accessToken!;
}

function get(path: string, token?: string) {
  return fetch(`${ORIGIN}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function issue(body: IssueCardRequest, token: string) {
  return fetch(`${ORIGIN}/api/cards`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function freeze(cardId: string, frozen: boolean, token: string) {
  return fetch(`${ORIGIN}/api/cards/${cardId}/freeze`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ frozen }),
  });
}

const validIssue: IssueCardRequest = {
  holderId: 'emp_reyes',
  monthlyLimit: { amountMinorUnits: 200_000, currency: 'USD' },
  allowedMccs: ['software', 'office_supplies'],
};

describe('GET /api/cards', () => {
  it('401s without a token', async () => {
    expect((await get('/api/cards')).status).toBe(401);
  });

  it('returns the wallet for any cards:view holder (e.g. an Employee)', async () => {
    const res = await get('/api/cards', await login(employee.email));
    expect(res.status).toBe(200);
    const body = (await res.json()) as CardListResponse;
    expect(body.cards.length).toBeGreaterThanOrEqual(5);
  });
});

describe('GET /api/cards/context (issuance form data)', () => {
  it('403s a caller without cards:manage', async () => {
    expect((await get('/api/cards/context', await login(employee.email))).status).toBe(403);
  });

  it('returns candidates + merchant categories for a Controller', async () => {
    const res = await get('/api/cards/context', await login(controller.email));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates.length).toBeGreaterThan(0);
    expect(body.merchantCategories.some((m: { code: string }) => m.code === 'software')).toBe(true);
  });
});

describe('POST /api/cards (issue — US-CW-014 AC-01)', () => {
  it('403s a caller without cards:manage', async () => {
    expect((await issue(validIssue, await login(employee.email))).status).toBe(403);
  });

  it('issues a card for a Controller', async () => {
    const res = await issue(validIssue, await login(controller.email));
    expect(res.status).toBe(201);
    const body = (await res.json()) as CardResponse;
    expect(body.card.allowedMccs).toEqual(['software', 'office_supplies']);
    expect(body.card.status).toBe('active');
  });

  it('422s an invalid monthly limit', async () => {
    const res = await issue(
      { ...validIssue, monthlyLimit: { amountMinorUnits: 0, currency: 'USD' } },
      await login(controller.email),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('invalid_limit');
  });
});

describe('GET /api/cards/:cardId', () => {
  it('returns a single card for a viewer', async () => {
    const res = await get('/api/cards/card_4021', await login(employee.email));
    expect(res.status).toBe(200);
    expect((await res.json()).card.last4).toBe('4021');
  });

  it('404s an unknown card', async () => {
    expect((await get('/api/cards/card_nope', await login(employee.email))).status).toBe(404);
  });
});

describe('POST /api/cards/:cardId/freeze (US-CW-014 AC-05)', () => {
  it('403s a caller without cards:manage', async () => {
    expect((await freeze('card_4021', true, await login(employee.email))).status).toBe(403);
  });

  it('freezes a card for a Controller', async () => {
    const res = await freeze('card_4021', true, await login(controller.email));
    expect(res.status).toBe(200);
    expect((await res.json()).card.status).toBe('frozen');
  });

  it('404s an unknown card', async () => {
    expect((await freeze('card_nope', true, await login(controller.email))).status).toBe(404);
  });
});
