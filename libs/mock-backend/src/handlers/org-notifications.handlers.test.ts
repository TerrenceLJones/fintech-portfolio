import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type {
  OrgNotificationSettingsResponse,
  RecipientCandidatesResponse,
} from '@clearline/contracts';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { OrgNotificationsService } from '../services/org-notifications.service';
import { buildSeedUser } from '../fixtures/test-factories';
import { SEED_ORGANIZATION } from '../fixtures/users.fixture';
import { createOrgNotificationsHandlers } from './org-notifications.handlers';

const BASE = 'http://localhost';
const PASSWORD = 'correct-password';
const ORG_ID = SEED_ORGANIZATION.id;

let server: ReturnType<typeof setupServer>;
let authService: AuthService;
let auditService: AuditService;
let service: OrgNotificationsService;

async function tokenFor(email: string): Promise<string> {
  const login = await authService.login(email, PASSWORD, '127.0.0.1');
  return login.accessToken!;
}

async function startWith() {
  const controller = await buildSeedUser({
    id: 'user_3',
    email: 'controller@clearline.dev',
    password: PASSWORD,
    role: 'controller',
    orgId: ORG_ID,
  });
  const employee = await buildSeedUser({
    id: 'user_2',
    email: 'employee@clearline.dev',
    password: PASSWORD,
    role: 'employee',
    orgId: ORG_ID,
  });
  authService = new AuthService([controller, employee]);
  auditService = new AuditService([]);
  service = new OrgNotificationsService();
  server = setupServer(...createOrgNotificationsHandlers(service, authService, auditService));
  server.listen({ onUnhandledRequest: 'error' });
}

function auth(token: string, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  };
}

beforeEach(startWith);
afterEach(() => server?.close());

describe('GET /api/org-notifications (AC-09)', () => {
  it('403s for an Employee', async () => {
    const token = await tokenFor('employee@clearline.dev');
    const res = await fetch(`${BASE}/api/org-notifications`, auth(token));
    expect(res.status).toBe(403);
  });

  it('returns settings for a Controller', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(`${BASE}/api/org-notifications`, auth(token));
    expect(res.status).toBe(200);
    const body = (await res.json()) as OrgNotificationSettingsResponse;
    expect(body.settings.approvalReminderFrequency).toBe('every_24_hours');
  });
});

describe('recipient add/remove (AC-07)', () => {
  it('adds a recipient and audits it', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/org-notifications/budget-alert-recipients`,
      auth(token, { method: 'POST', body: JSON.stringify({ recipientId: 'user_1' }) }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as OrgNotificationSettingsResponse;
    expect(body.settings.budgetAlertRecipients.some((r) => r.id === 'user_1')).toBe(true);
    expect(auditService.list()[0]!.category).toBe('org_notification');
  });

  it('409s adding an existing recipient', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/org-notifications/budget-alert-recipients`,
      auth(token, { method: 'POST', body: JSON.stringify({ recipientId: 'user_3' }) }),
    );
    expect(res.status).toBe(409);
  });

  it('removes a recipient and audits it', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/org-notifications/budget-alert-recipients/user_3`,
      auth(token, { method: 'DELETE' }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as OrgNotificationSettingsResponse;
    expect(body.settings.budgetAlertRecipients).toHaveLength(0);
    expect(auditService.list()[0]!.action).toContain('Removed');
  });

  it('lists candidates excluding current recipients', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(`${BASE}/api/org-notifications/candidates`, auth(token));
    const body = (await res.json()) as RecipientCandidatesResponse;
    expect(body.candidates.some((c) => c.id === 'user_3')).toBe(false);
    expect(body.candidates.some((c) => c.id === 'user_1')).toBe(true);
  });
});

describe('reminder frequency (AC-08)', () => {
  it('sets the cadence and records a before → after diff', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/org-notifications/approval-reminder`,
      auth(token, { method: 'PUT', body: JSON.stringify({ frequency: 'every_72_hours' }) }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as OrgNotificationSettingsResponse;
    expect(body.settings.approvalReminderFrequency).toBe('every_72_hours');
    expect(auditService.list()[0]!.diff).toBeDefined();
  });

  it('422s an invalid cadence', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/org-notifications/approval-reminder`,
      auth(token, { method: 'PUT', body: JSON.stringify({ frequency: 'hourly' }) }),
    );
    expect(res.status).toBe(422);
  });
});
