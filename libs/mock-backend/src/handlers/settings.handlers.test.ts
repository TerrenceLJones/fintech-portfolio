import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { SettingsSectionAccessResponse } from '@clearline/contracts';
import { createSettingsHandlers } from './settings.handlers';
import { AuthService } from '../services/auth.service';
import { DEMO_USER_PASSWORD } from '../fixtures/users.fixture';

const IP = '127.0.0.1 (mocked)';
const ORIGIN = 'http://settings-test.example';

let authService: AuthService;
let server: ReturnType<typeof setupServer>;

beforeAll(() => {
  server = setupServer();
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  authService = new AuthService();
  server.use(...createSettingsHandlers(authService));
});

async function loginAs(email: string): Promise<string> {
  const { accessToken } = await authService.login(email, DEMO_USER_PASSWORD, IP);
  return accessToken!;
}

function access(token: string | undefined, slug: string) {
  return fetch(`${ORIGIN}/api/settings/sections/${slug}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('GET /api/settings/sections/:slug (US-CW-033 AC-04)', () => {
  it('authorizes a Profile section for any authenticated user, including an Employee', async () => {
    const token = await loginAs('employee@clearline.dev');
    const response = await access(token, 'personal');
    expect(response.status).toBe(200);
    const body = (await response.json()) as SettingsSectionAccessResponse;
    expect(body).toEqual({ slug: 'personal', authorized: true });
  });

  it('returns 403 forbidden_role when an Employee reaches an Organization section', async () => {
    const token = await loginAs('employee@clearline.dev');
    const response = await access(token, 'billing');
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden_role' });
  });

  it('authorizes an org-config section for a Controller/Admin (owner@ is the org Owner)', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await access(token, 'company');
    expect(response.status).toBe(200);
  });

  it('authorizes an Admin/Owner-only section for the Owner', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await access(token, 'developer');
    expect(response.status).toBe(200);
  });

  it('gates the relocated Team & Members section on team:view — 403 for an Employee, 200 for the Owner', async () => {
    const employeeToken = await loginAs('employee@clearline.dev');
    expect((await access(employeeToken, 'team')).status).toBe(403);

    const ownerToken = await loginAs('owner@clearline.dev');
    expect((await access(ownerToken, 'team')).status).toBe(200);
  });

  it('returns 401 when unauthenticated', async () => {
    const response = await access(undefined, 'personal');
    expect(response.status).toBe(401);
  });

  it('returns 404 for an unknown settings section slug', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await access(token, 'not-a-real-section');
    expect(response.status).toBe(404);
  });
});
