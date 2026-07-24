import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { IssueCardRequest, OnboardingTasksResponse } from '@clearline/contracts';
import { createOnboardingTasksHandlers } from './onboarding-tasks.handlers';
import { createExpensesHandlers } from './expenses.handlers';
import { createCardsHandlers } from './cards.handlers';
import { AuthService } from '../services/auth.service';
import { ExpensesService } from '../services/expenses.service';
import { ApprovalsService } from '../services/approvals.service';
import { CardsService } from '../services/cards.service';
import { OnboardingTasksService } from '../services/onboarding-tasks.service';
import { SEED_USERS, DEMO_USER_PASSWORD } from '../fixtures/users.fixture';

const IP = '127.0.0.1 (mocked)';
const ORIGIN = 'http://onboarding-tasks-test.example';

const employee = SEED_USERS.find((u) => u.role === 'employee')!;
const controller = SEED_USERS.find((u) => u.role === 'controller')!;

let authService: AuthService;
let tasksService: OnboardingTasksService;
let expensesService: ExpensesService;
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
  tasksService = new OnboardingTasksService();
  expensesService = new ExpensesService(undefined, undefined, new ApprovalsService());
  cardsService = new CardsService();
  // All the emitters and the read endpoint bind to the SAME injected tasks service, mirroring how
  // they share the singleton in production — so a completion recorded by one is read by the other.
  server.use(
    ...createOnboardingTasksHandlers(tasksService, authService),
    ...createExpensesHandlers(expensesService, authService, tasksService),
    ...createCardsHandlers(cardsService, authService, undefined, tasksService),
  );
});

async function login(email: string): Promise<string> {
  const { accessToken } = await authService.login(email, DEMO_USER_PASSWORD, IP);
  return accessToken!;
}

function getTasks(token?: string) {
  return fetch(`${ORIGIN}/api/onboarding/tasks`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function post(path: string, token?: string) {
  return fetch(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('GET /api/onboarding/tasks', () => {
  it('401s an unauthenticated caller', async () => {
    expect((await getTasks()).status).toBe(401);
  });

  it('returns an empty read model for a user with no recorded activity', async () => {
    const token = await login(employee.email);
    const response = await getTasks(token);
    expect(response.status).toBe(200);
    expect((await response.json()) as OnboardingTasksResponse).toEqual({
      completed: [],
      milestoneShown: false,
    });
  });
});

describe('POST /api/onboarding/tasks/:id/complete', () => {
  it('records a visit task as complete (US-CW-046 visit path)', async () => {
    const token = await login(employee.email);
    const response = await post('/api/onboarding/tasks/see-cards/complete', token);
    expect(response.status).toBe(200);
    expect(((await response.json()) as OnboardingTasksResponse).completed).toEqual(['see-cards']);
  });

  it('refuses to complete an event task via the client endpoint — no self-report (US-CW-047 AC-02)', async () => {
    const token = await login(employee.email);
    const response = await post('/api/onboarding/tasks/submit-expense/complete', token);
    expect(response.status).toBe(400);
    // And the task stays incomplete.
    expect(((await (await getTasks(token)).json()) as OnboardingTasksResponse).completed).toEqual(
      [],
    );
  });
});

describe('POST /api/onboarding/tasks/:id/force-complete (dev shortcut)', () => {
  it('force-completes an event task the honest endpoint would refuse — for the beacon shortcuts', async () => {
    const token = await login(employee.email);
    const response = await post('/api/onboarding/tasks/clear-approval/force-complete', token);
    expect(response.status).toBe(200);
    expect(((await response.json()) as OnboardingTasksResponse).completed).toContain(
      'clear-approval',
    );
  });

  it('400s an unknown task id', async () => {
    const token = await login(employee.email);
    expect((await post('/api/onboarding/tasks/not-a-task/force-complete', token)).status).toBe(400);
  });
});

describe('POST /api/onboarding/milestone', () => {
  it('latches the once-per-user signature milestone (US-CW-047 AC-03)', async () => {
    const token = await login(employee.email);
    await post('/api/onboarding/milestone', token);
    expect(((await (await getTasks(token)).json()) as OnboardingTasksResponse).milestoneShown).toBe(
      true,
    );
  });
});

describe('POST /api/onboarding/tasks/reset', () => {
  it('clears a user back to no progress (beacon reset control)', async () => {
    const token = await login(employee.email);
    await post('/api/onboarding/tasks/see-cards/complete', token);
    await post('/api/onboarding/milestone', token);

    await post('/api/onboarding/tasks/reset', token);
    expect((await (await getTasks(token)).json()) as OnboardingTasksResponse).toEqual({
      completed: [],
      milestoneShown: false,
    });
  });
});

describe('event-driven completion (US-CW-047 AC-01)', () => {
  it('marks "submit-expense" complete when an expense is actually submitted', async () => {
    const token = await login(employee.email);
    const submit = await fetch(`${ORIGIN}/api/expenses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: { amountMinorUnits: 3_000, currency: 'USD' },
        categoryId: 'meals',
        merchant: 'Blue Bottle',
      }),
    });
    expect(submit.status).toBe(201);

    const tasks = (await (await getTasks(token)).json()) as OnboardingTasksResponse;
    expect(tasks.completed).toContain('submit-expense');
  });

  it('marks "issue-card" complete when a Controller issues a card', async () => {
    const token = await login(controller.email);
    const payload: IssueCardRequest = {
      holderId: 'emp_reyes',
      monthlyLimit: { amountMinorUnits: 200_000, currency: 'USD' },
      allowedMccs: ['software'],
    };
    const issued = await fetch(`${ORIGIN}/api/cards`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(issued.status).toBe(201);

    const tasks = (await (await getTasks(token)).json()) as OnboardingTasksResponse;
    expect(tasks.completed).toContain('issue-card');
  });
});
