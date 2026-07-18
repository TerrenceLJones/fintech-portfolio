import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type {
  AcceptInviteResponse,
  InviteDetailsResponse,
  TeamRosterResponse,
} from '@clearline/contracts';
import { createTeamHandlers } from './team.handlers';
import { AuthService } from '../services/auth.service';
import { AuditService } from '../services/audit.service';
import { DEMO_USER_PASSWORD, SEED_ORGANIZATION } from '../fixtures/users.fixture';

const IP = '127.0.0.1 (mocked)';
const ORIGIN = 'http://team-test.example';
const STRONG_PASSWORD = DEMO_USER_PASSWORD;

let authService: AuthService;
let auditService: AuditService;
let server: ReturnType<typeof setupServer>;

beforeAll(() => {
  server = setupServer();
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  authService = new AuthService();
  auditService = new AuditService([]);
  server.use(...createTeamHandlers(authService, auditService));
});

async function loginAs(email: string): Promise<string> {
  const { accessToken } = await authService.login(email, DEMO_USER_PASSWORD, IP);
  return accessToken!;
}

function auth(token: string) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

describe('GET /api/team/members (US-CW-031 AC-07)', () => {
  it('returns the roster for an Owner', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/team/members`, { headers: auth(token) });
    expect(response.status).toBe(200);
    const body = (await response.json()) as TeamRosterResponse;
    expect(body.organizationName).toBe('Clearline Demo Co');
    expect(body.members.length).toBeGreaterThanOrEqual(4);
  });

  it('rejects a plain Employee with 403 (server decides, regardless of client)', async () => {
    const token = await loginAs('employee@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/team/members`, { headers: auth(token) });
    expect(response.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const response = await fetch(`${ORIGIN}/api/team/members`);
    expect(response.status).toBe(401);
  });
});

describe('POST /api/team/invites (US-CW-031 AC-01)', () => {
  it('accepts an Owner’s invite and returns an enumeration-safe empty body', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/team/invites`, {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({
        email: 'newhire@acme.test',
        role: 'finance_manager',
        grantAdmin: false,
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});

    // The invite shows up as pending on the roster.
    const roster = (await (
      await fetch(`${ORIGIN}/api/team/members`, { headers: auth(token) })
    ).json()) as TeamRosterResponse;
    expect(roster.invites.map((i) => i.email)).toContain('newhire@acme.test');
  });

  it('rejects an Employee’s invite attempt server-side with 403 (AC-07)', async () => {
    const token = await loginAs('employee@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/team/invites`, {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ email: 'newhire@acme.test', role: 'employee', grantAdmin: false }),
    });
    expect(response.status).toBe(403);
  });
});

describe('invite acceptance (US-CW-031 AC-02/AC-03) — public', () => {
  async function mintInvite(email = 'newhire@acme.test'): Promise<string> {
    const { token } = await authService.createInvite({
      orgId: SEED_ORGANIZATION.id,
      email,
      role: 'finance_manager',
      grantAdmin: false,
      inviterName: 'Priya Nair',
    });
    return token!;
  }

  it('GET returns valid details without authentication', async () => {
    const inviteToken = await mintInvite();
    const response = await fetch(`${ORIGIN}/api/team/invites/${inviteToken}`);
    const body = (await response.json()) as InviteDetailsResponse;
    expect(body).toMatchObject({
      status: 'valid',
      role: 'finance_manager',
      email: 'newhire@acme.test',
    });
  });

  it('POST accept sets a password, joins the org, and logs the invitee in', async () => {
    const inviteToken = await mintInvite();
    const response = await fetch(`${ORIGIN}/api/team/invites/${inviteToken}/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: STRONG_PASSWORD }),
    });
    const body = (await response.json()) as AcceptInviteResponse;
    expect(body.outcome).toBe('success');
    expect(body.accessToken).toBeDefined();
    expect(response.headers.get('set-cookie')).toContain('refreshToken=');
    expect(authService.checkSession(body.accessToken!).role).toBe('finance_manager');
  });

  it('POST accept returns a weak_password outcome without joining', async () => {
    const inviteToken = await mintInvite();
    const response = await fetch(`${ORIGIN}/api/team/invites/${inviteToken}/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'weak' }),
    });
    expect(((await response.json()) as AcceptInviteResponse).outcome).toBe('weak_password');
  });
});

describe('PATCH /api/team/members/:id/role (US-CW-031 AC-04)', () => {
  it('changes a member’s role and records a role_change audit event', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/team/members/user_2/role`, {
      method: 'PATCH',
      headers: auth(token),
      body: JSON.stringify({ role: 'controller' }),
    });
    expect(response.status).toBe(200);

    const [event] = auditService.list();
    expect(event!.category).toBe('role_change');
    expect(event!.diff).toMatchObject({ from: 'Employee', to: 'Controller' });
    expect(event!.actor.name).toBe('Priya Nair');
  });

  it('refuses to change the Owner’s role with 403 owner_protected (US-CW-030 AC-03)', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/team/members/user_owner/role`, {
      method: 'PATCH',
      headers: auth(token),
      body: JSON.stringify({ role: 'employee' }),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('owner_protected');
  });

  it('rejects a non-admin caller with 403 (AC-07)', async () => {
    const token = await loginAs('employee@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/team/members/user_3/role`, {
      method: 'PATCH',
      headers: auth(token),
      body: JSON.stringify({ role: 'employee' }),
    });
    expect(response.status).toBe(403);
  });
});

describe('grant / revoke Admin (US-CW-031 AC-08)', () => {
  it('lets the Owner grant Admin and records a "Granted Admin" audit event', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/team/members/user_2/role`, {
      method: 'PATCH',
      headers: auth(token),
      body: JSON.stringify({ role: 'employee', grantAdmin: true }),
    });
    expect(response.status).toBe(200);

    const [event] = auditService.list();
    expect(event!.action).toContain('Granted Admin');
    expect(event!.diff).toMatchObject({ from: 'Member', to: 'Admin' });
  });

  it('lets the Owner revoke Admin from an existing Admin', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/team/members/user_3/role`, {
      method: 'PATCH',
      headers: auth(token),
      body: JSON.stringify({ role: 'controller', grantAdmin: false }),
    });
    expect(response.status).toBe(200);
    expect(auditService.list()[0]!.action).toContain('Revoked Admin');
  });

  it('forbids a non-Owner Admin from revoking Admin (403 admin_revoke_forbidden)', async () => {
    // Sofia (controller@) is an Admin but not the Owner — she can't strip her own (or anyone's) Admin.
    const token = await loginAs('controller@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/team/members/user_3/role`, {
      method: 'PATCH',
      headers: auth(token),
      body: JSON.stringify({ role: 'controller', grantAdmin: false }),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('admin_revoke_forbidden');
  });
});

describe('DELETE /api/team/members/:id (US-CW-031 AC-05)', () => {
  it('removes a member, records an audit event, and invalidates their session', async () => {
    const ownerToken = await loginAs('owner@clearline.dev');
    const victimToken = await loginAs('employee@clearline.dev');
    expect(authService.checkSession(victimToken).outcome).toBe('active');

    const response = await fetch(`${ORIGIN}/api/team/members/user_2`, {
      method: 'DELETE',
      headers: auth(ownerToken),
    });
    expect(response.status).toBe(204);
    expect(authService.checkSession(victimToken).outcome).toBe('revoked');
    expect(auditService.list()[0]!.action).toContain('Removed member');
  });

  it('never removes the Owner (403 owner_protected)', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/team/members/user_owner`, {
      method: 'DELETE',
      headers: auth(token),
    });
    expect(response.status).toBe(403);
  });
});
