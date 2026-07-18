import { beforeEach, describe, expect, it } from 'vitest';
import { INVITE_TOKEN_TTL_MS } from '@clearline/domain-auth';
import { AuthService } from './auth.service';
import { DEMO_USER_PASSWORD, SEED_ORGANIZATION } from '../fixtures/users.fixture';

const IP = '127.0.0.1 (mocked)';
const ORG_ID = SEED_ORGANIZATION.id;
const OWNER_EMAIL = 'owner@clearline.dev';
const NEW_EIN = '12-3456789';

let auth: AuthService;
beforeEach(() => {
  auth = new AuthService();
});

describe('getTeamRoster (US-CW-030 / Design §18.1)', () => {
  it('returns the org name, its members sorted by join date, and no pending invites initially', () => {
    const roster = auth.getTeamRoster(ORG_ID)!;
    expect(roster.organizationName).toBe('Clearline Demo Co');
    expect(roster.members.map((m) => m.email)).toEqual([
      'owner@clearline.dev', // joined first
      'demo@clearline.dev',
      'controller@clearline.dev',
      'employee@clearline.dev',
    ]);
    expect(roster.members.find((m) => m.email === OWNER_EMAIL)!.isOwner).toBe(true);
    expect(roster.invites).toEqual([]);
  });

  it('returns null for an unknown organization', () => {
    expect(auth.getTeamRoster('org_nope')).toBeNull();
  });
});

describe('provisionOrganizationForOwner (US-CW-030 AC-01/AC-02/AC-04)', () => {
  async function freshApprovedCreator(email: string): Promise<void> {
    const { verificationToken } = await auth.signUp(email, DEMO_USER_PASSWORD);
    await auth.verifyEmail(verificationToken!);
  }

  it('creates an Organization keyed to the EIN and assigns the creator as Owner, atomically', async () => {
    await freshApprovedCreator('founder@northwind.test');
    const org = auth.provisionOrganizationForOwner('founder@northwind.test', {
      legalName: 'Northwind Labs, Inc.',
      ein: NEW_EIN,
    })!;

    expect(org.legalName).toBe('Northwind Labs, Inc.');
    expect(org.ein).toBe(NEW_EIN);

    const roster = auth.getTeamRoster(org.id)!;
    const owner = roster.members.find((m) => m.email === 'founder@northwind.test')!;
    expect(owner.isOwner).toBe(true);
    expect(owner.role).toBe('controller');
  });

  it('is idempotent per EIN — re-provisioning the same EIN creates no second organization (AC-04)', async () => {
    await freshApprovedCreator('founder@northwind.test');
    const first = auth.provisionOrganizationForOwner('founder@northwind.test', {
      legalName: 'Northwind Labs, Inc.',
      ein: NEW_EIN,
    })!;
    const second = auth.provisionOrganizationForOwner('founder@northwind.test', {
      legalName: 'Northwind Labs, Inc.',
      ein: NEW_EIN,
    })!;
    expect(second.id).toBe(first.id);
  });

  it('returns null for an unknown email', () => {
    expect(
      auth.provisionOrganizationForOwner('nobody@nowhere.test', { legalName: 'X', ein: NEW_EIN }),
    ).toBeNull();
  });
});

describe('createInvite (US-CW-031 AC-01, enumeration-safe)', () => {
  const invite = (email: string) =>
    auth.createInvite({
      orgId: ORG_ID,
      email,
      role: 'finance_manager',
      grantAdmin: false,
      inviterName: 'Priya Nair',
    });

  it('mints a single-use token for a brand-new email and lists it as a pending invite', async () => {
    const result = await invite('newhire@clearline.dev');
    expect(result.outcome).toBe('sent');
    expect(result.token).toMatch(/^invite_/);

    const roster = auth.getTeamRoster(ORG_ID)!;
    expect(roster.invites.map((i) => i.email)).toContain('newhire@clearline.dev');
  });

  it('reports already_member and mints nothing when the email is already in this org', async () => {
    const result = await invite('employee@clearline.dev');
    expect(result.outcome).toBe('already_member');
    expect(result.token).toBeUndefined();
  });

  it('stays enumeration-safe: reports sent but leaks no token for an email already a member elsewhere', async () => {
    // Give someone@else.test an account by inviting + accepting into a different org first.
    const elsewhere = await auth.createInvite({
      orgId: 'org_other',
      email: 'someone@else.test',
      role: 'employee',
      grantAdmin: false,
      inviterName: 'X',
    });
    await auth.acceptInvite(elsewhere.token!, DEMO_USER_PASSWORD);

    // Inviting that now-existing member into our org returns the same "sent" shape but mints no token.
    const result = await invite('someone@else.test');
    expect(result.outcome).toBe('sent');
    expect(result.token).toBeUndefined();
  });

  it('does not create a second outstanding invite for the same email+org (dedupe)', async () => {
    await invite('newhire@clearline.dev');
    const second = await invite('newhire@clearline.dev');
    expect(second.token).toBeUndefined();
    expect(
      auth.getTeamRoster(ORG_ID)!.invites.filter((i) => i.email === 'newhire@clearline.dev'),
    ).toHaveLength(1);
  });
});

describe('getInviteDetails (Design §18.3)', () => {
  it('returns valid with inviter/org/role/email for a fresh token', async () => {
    const { token } = await auth.createInvite({
      orgId: ORG_ID,
      email: 'newhire@clearline.dev',
      role: 'finance_manager',
      grantAdmin: false,
      inviterName: 'Priya Nair',
    });
    const details = await auth.getInviteDetails(token!);
    expect(details).toMatchObject({
      status: 'valid',
      inviterName: 'Priya Nair',
      organizationName: 'Clearline Demo Co',
      role: 'finance_manager',
      email: 'newhire@clearline.dev',
    });
  });

  it('returns expired for a token issued more than 7 days ago (AC-03)', async () => {
    const issuedAt = 1_000_000;
    const { token } = await auth.createInvite(
      {
        orgId: ORG_ID,
        email: 'late@clearline.dev',
        role: 'employee',
        grantAdmin: false,
        inviterName: 'Priya Nair',
      },
      issuedAt,
    );
    const details = await auth.getInviteDetails(token!, issuedAt + INVITE_TOKEN_TTL_MS + 1);
    expect(details.status).toBe('expired');
  });

  it('returns invalid for a garbage token', async () => {
    expect((await auth.getInviteDetails('invite_nope')).status).toBe('invalid');
  });
});

describe('acceptInvite (US-CW-031 AC-02/AC-03)', () => {
  async function makeInvite(email = 'newhire@clearline.dev', now?: number) {
    const { token } = await auth.createInvite(
      {
        orgId: ORG_ID,
        email,
        role: 'finance_manager',
        grantAdmin: false,
        inviterName: 'Priya Nair',
      },
      now,
    );
    return token!;
  }

  it('creates the account in the inviting org with the invited role and logs them in', async () => {
    const token = await makeInvite();
    const result = await auth.acceptInvite(token, DEMO_USER_PASSWORD);
    expect(result.outcome).toBe('success');
    expect(result.accessToken).toBeDefined();

    const session = auth.checkSession(result.accessToken!);
    expect(session.outcome).toBe('active');
    expect(session.role).toBe('finance_manager');

    expect(auth.getTeamRoster(ORG_ID)!.members.map((m) => m.email)).toContain(
      'newhire@clearline.dev',
    );
  });

  it('rejects a weak password without creating an account', async () => {
    const token = await makeInvite();
    const result = await auth.acceptInvite(token, 'weak');
    expect(result.outcome).toBe('weak_password');
    expect(auth.getTeamRoster(ORG_ID)!.members.map((m) => m.email)).not.toContain(
      'newhire@clearline.dev',
    );
  });

  it('is single-use — a consumed token cannot be replayed', async () => {
    const token = await makeInvite();
    await auth.acceptInvite(token, DEMO_USER_PASSWORD);
    expect((await auth.acceptInvite(token, DEMO_USER_PASSWORD)).outcome).toBe('invite_invalid');
  });

  it('grants no membership for an expired token (AC-03)', async () => {
    const issuedAt = 1_000_000;
    const token = await makeInvite('late@clearline.dev', issuedAt);
    const result = await auth.acceptInvite(
      token,
      DEMO_USER_PASSWORD,
      issuedAt + INVITE_TOKEN_TTL_MS + 1,
    );
    expect(result.outcome).toBe('invite_expired');
  });
});

describe('changeMemberRole (US-CW-031 AC-04 / US-CW-030 AC-03)', () => {
  const employeeId = 'user_2';
  const ownerId = 'user_owner';

  it('changes a member’s tier and returns the prior role for the audit diff', () => {
    const result = auth.changeMemberRole(ORG_ID, employeeId, { role: 'controller' });
    expect(result.outcome).toBe('ok');
    expect(result.previousRole).toBe('employee');
    expect(result.member!.role).toBe('controller');
  });

  it('refuses to change the Owner’s role (owner is protected)', () => {
    expect(auth.changeMemberRole(ORG_ID, ownerId, { role: 'employee' }).outcome).toBe(
      'owner_protected',
    );
  });

  it('reports member_not_found for someone outside the actor’s org', () => {
    expect(auth.changeMemberRole('org_other', employeeId, { role: 'controller' }).outcome).toBe(
      'member_not_found',
    );
  });
});

describe('grant / revoke Admin (US-CW-031 AC-08)', () => {
  const employeeId = 'user_2'; // not an admin in the seed
  const adminId = 'user_3'; // controller@ is Admin in the seed

  it('lets the Owner grant Admin to a member, reporting the prior flag for the audit diff', () => {
    const result = auth.changeMemberRole(
      ORG_ID,
      employeeId,
      { role: 'employee', grantAdmin: true },
      true,
    );
    expect(result.outcome).toBe('ok');
    expect(result.previousIsAdmin).toBe(false);
    expect(result.member!.isAdmin).toBe(true);
  });

  it('lets the Owner revoke Admin from a member', () => {
    const result = auth.changeMemberRole(
      ORG_ID,
      adminId,
      { role: 'controller', grantAdmin: false },
      true,
    );
    expect(result.outcome).toBe('ok');
    expect(result.member!.isAdmin).toBe(false);
  });

  it('lets a non-Owner Admin GRANT Admin (delegation is allowed)', () => {
    const result = auth.changeMemberRole(
      ORG_ID,
      employeeId,
      { role: 'employee', grantAdmin: true },
      false,
    );
    expect(result.outcome).toBe('ok');
    expect(result.member!.isAdmin).toBe(true);
  });

  it('forbids a non-Owner from REVOKING Admin — from another Admin or themselves', () => {
    const result = auth.changeMemberRole(
      ORG_ID,
      adminId,
      { role: 'controller', grantAdmin: false },
      false,
    );
    expect(result.outcome).toBe('admin_revoke_forbidden');
    // The member keeps Admin — the revoke did not take effect.
    expect(auth.getTeamRoster(ORG_ID)!.members.find((m) => m.id === adminId)!.isAdmin).toBe(true);
  });

  it('leaves the Admin flag untouched when grantAdmin is omitted (tier-only change)', () => {
    const result = auth.changeMemberRole(ORG_ID, adminId, { role: 'finance_manager' }, false);
    expect(result.outcome).toBe('ok');
    expect(result.member!.isAdmin).toBe(true);
  });
});

describe('removeMember (US-CW-031 AC-05 / US-CW-030 AC-03)', () => {
  it('removes a member, drops them from the roster, and revokes their sessions', async () => {
    const { accessToken } = await auth.login('employee@clearline.dev', DEMO_USER_PASSWORD, IP);
    expect(auth.checkSession(accessToken!).outcome).toBe('active');

    const result = auth.removeMember(ORG_ID, 'user_2');
    expect(result.outcome).toBe('ok');
    expect(auth.getTeamRoster(ORG_ID)!.members.map((m) => m.email)).not.toContain(
      'employee@clearline.dev',
    );
    expect(auth.checkSession(accessToken!).outcome).toBe('revoked');
  });

  it('never removes the Owner', () => {
    expect(auth.removeMember(ORG_ID, 'user_owner').outcome).toBe('owner_protected');
  });

  it('reports member_not_found for an unknown member', () => {
    expect(auth.removeMember(ORG_ID, 'user_nope').outcome).toBe('member_not_found');
  });
});
