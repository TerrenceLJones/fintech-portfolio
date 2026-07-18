import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createOnboardingHandlers } from './onboarding.handlers';
import { OnboardingService } from '../services/onboarding.service';
import { AuthService } from '../services/auth.service';
import { SEED_USERS, DEMO_USER_PASSWORD } from '../fixtures/users.fixture';
import type { SeedUser } from '../fixtures/users.fixture';

const [seedUser] = SEED_USERS;
const IP = '127.0.0.1 (mocked)';
const KNOWN_EIN = '12-3456789';

let hostCounter = 0;
function uniqueOrigin(): string {
  hostCounter += 1;
  return `http://onboarding-test-${hostCounter}.example`;
}

function startServer() {
  const authService = new AuthService();
  const onboardingService = new OnboardingService();
  const server = setupServer(...createOnboardingHandlers(onboardingService, authService));
  server.listen({ onUnhandledRequest: 'error' });
  return { server, authService, onboardingService };
}

async function accessTokenFor(authService: AuthService): Promise<string> {
  const { accessToken } = await authService.login(seedUser!.email, DEMO_USER_PASSWORD, IP);
  return accessToken!;
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}

describe('onboarding handlers', () => {
  let server: ReturnType<typeof setupServer>;
  let authService: AuthService;
  let onboardingService: OnboardingService;

  beforeAll(() => {
    ({ server, authService, onboardingService } = startServer());
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('rejects an unauthenticated status request', async () => {
    const response = await fetch(`${uniqueOrigin()}/api/onboarding/status`);
    expect(response.status).toBe(401);
  });

  it('returns a fresh in-progress status for an authenticated first-time user', async () => {
    const token = await accessTokenFor(authService);
    const response = await fetch(`${uniqueOrigin()}/api/onboarding/status`, {
      headers: authHeaders(token),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: 'in_progress', currentStep: 'business' });
  });

  it('submits business info and reports the verified outcome', async () => {
    const token = await accessTokenFor(authService);
    const response = await fetch(`${uniqueOrigin()}/api/onboarding/business`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        legalName: 'Northwind Labs, Inc.',
        ein: KNOWN_EIN,
        structure: 'C-Corporation',
        addressLine1: '220 Mission St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ outcome: 'verified' });
  });

  it('adds a beneficial owner and returns the masked owner record', async () => {
    const token = await accessTokenFor(authService);
    const response = await fetch(`${uniqueOrigin()}/api/onboarding/owners`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Dara',
        lastName: 'Reyes',
        ownershipPercent: 60,
        ssnItin: '123-45-4417',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.owner).toMatchObject({
      firstName: 'Dara',
      lastName: 'Reyes',
      fullName: 'Dara Reyes',
      requiresKyc: true,
      ssnItinLast4: '4417',
    });
  });

  it('marks a step complete', async () => {
    const token = await accessTokenFor(authService);
    const response = await fetch(`${uniqueOrigin()}/api/onboarding/steps/owners/complete`, {
      method: 'POST',
      headers: authHeaders(token),
    });

    expect(response.status).toBe(200);
  });

  it('submits a document and reports the outcome', async () => {
    const token = await accessTokenFor(authService);
    const response = await fetch(`${uniqueOrigin()}/api/onboarding/documents`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        ownerId: 'owner_1',
        ocrText: 'CALIFORNIA DRIVER LICENSE DL I1234562',
        mimeType: 'image/jpeg',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.outcome).toBe('accepted');
  });

  it('submits the review and reports the outcome', async () => {
    const token = await accessTokenFor(authService);
    const response = await fetch(`${uniqueOrigin()}/api/onboarding/review/submit`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(['approved', 'under_review']).toContain(body.outcome);
  });

  it('shares state with the underlying OnboardingService instance passed in', async () => {
    const token = await accessTokenFor(authService);
    await fetch(`${uniqueOrigin()}/api/onboarding/business`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        legalName: 'Test Co',
        ein: KNOWN_EIN,
        structure: 'LLC',
        addressLine1: '1 Main St',
        city: 'SF',
        state: 'CA',
        postalCode: '94105',
      }),
    });

    const { userId } = authService.checkSession(token) as { userId: string };
    expect(onboardingService.getStatus(userId).business).toMatchObject({ ein: KNOWN_EIN });
  });
});

describe('review submission — owner provisioning at KYB approval (US-CW-030)', () => {
  const APPROVED_USER = seedUser!; // completes full KYB -> approved -> elevated
  const PENDING_USER: SeedUser = {
    ...seedUser!,
    id: 'user_pending',
    email: 'pending@clearline.dev',
  };
  const INCOMPLETE_USER: SeedUser = {
    ...seedUser!,
    id: 'user_incomplete',
    email: 'incomplete@clearline.dev',
  };
  const RESUBMIT_USER: SeedUser = {
    ...seedUser!,
    id: 'user_resubmit',
    email: 'resubmit@clearline.dev',
  };

  let server: ReturnType<typeof setupServer>;
  let authService: AuthService;

  beforeAll(() => {
    authService = new AuthService([APPROVED_USER, PENDING_USER, INCOMPLETE_USER, RESUBMIT_USER]);
    const onboardingService = new OnboardingService();
    server = setupServer(...createOnboardingHandlers(onboardingService, authService));
    server.listen({ onUnhandledRequest: 'error' });
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  async function tokenFor(email: string): Promise<string> {
    const { accessToken } = await authService.login(email, DEMO_USER_PASSWORD, IP);
    return accessToken!;
  }

  async function submitBusiness(origin: string, token: string, legalName: string, ein: string) {
    return fetch(`${origin}/api/onboarding/business`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        legalName,
        ein,
        structure: 'C-Corporation',
        addressLine1: '220 Mission St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
      }),
    });
  }

  async function addOwner(origin: string, token: string): Promise<string> {
    const res = await fetch(`${origin}/api/onboarding/owners`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Dara',
        lastName: 'Reyes',
        ownershipPercent: 60,
        ssnItin: '123-45-4417',
      }),
    });
    return (await res.json()).owner.id;
  }

  async function submitDocument(origin: string, token: string, ownerId: string) {
    return fetch(`${origin}/api/onboarding/documents`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        ownerId,
        ocrText: 'CALIFORNIA DRIVER LICENSE DL I1234562',
        mimeType: 'image/jpeg',
      }),
    });
  }

  /** Walk the full wizard (business -> owner -> verified document) so the record is KYB-complete. */
  async function completeKyb(origin: string, token: string, legalName: string, ein: string) {
    await submitBusiness(origin, token, legalName, ein);
    const ownerId = await addOwner(origin, token);
    await submitDocument(origin, token, ownerId);
  }

  function submitReview(origin: string, token: string) {
    return fetch(`${origin}/api/onboarding/review/submit`, {
      method: 'POST',
      headers: authHeaders(token),
    });
  }

  it('elevates the creator to Controller + Owner when a complete KYB is approved (AC-01/AC-02)', async () => {
    const origin = uniqueOrigin();
    const token = await tokenFor(APPROVED_USER.email);
    await completeKyb(origin, token, 'Northwind Labs, Inc.', '12-3456789');

    const response = await submitReview(origin, token);
    expect((await response.json()).outcome).toBe('approved');

    const session = authService.checkSession(token);
    expect(session).toMatchObject({ role: 'controller', approvalLimit: null, isOwner: true });

    // US-CW-030 AC-01: an Organization record is created, keyed to the verified business, with the
    // creator assigned Owner on it — not merely an isOwner flag on a user with no org.
    const orgId = authService.getOrgIdForUser(session.userId!);
    expect(orgId).toBeTruthy();
    const roster = authService.getTeamRoster(orgId!)!;
    expect(roster.organizationName).toBe('Northwind Labs, Inc.');
    expect(roster.members.find((m) => m.id === session.userId)?.isOwner).toBe(true);
  });

  it('does not elevate when the review is routed to under_review (AC-01)', async () => {
    const origin = uniqueOrigin();
    const token = await tokenFor(PENDING_USER.email);
    // A watchlisted legal name routes the submission to compliance review, not approval.
    await submitBusiness(origin, token, 'Vostok Trading LLC', '98-7654321');

    const response = await submitReview(origin, token);
    expect((await response.json()).outcome).toBe('under_review');

    const session = authService.checkSession(token);
    expect(session).toMatchObject({ role: 'finance_manager', isOwner: false });
  });

  it('does not elevate a bare submit that skips the KYB wizard, even though it approves', async () => {
    const origin = uniqueOrigin();
    const token = await tokenFor(INCOMPLETE_USER.email);
    // No business/owner/document submitted — a direct review submit still approves (app access),
    // but must not confer Controller + Owner on an unfinished application.
    const response = await submitReview(origin, token);
    expect((await response.json()).outcome).toBe('approved');

    const session = authService.checkSession(token);
    expect(session).toMatchObject({ role: 'finance_manager', isOwner: false });
  });

  it('does not re-elevate on a re-submission after the owner has been changed', async () => {
    const origin = uniqueOrigin();
    const token = await tokenFor(RESUBMIT_USER.email);
    await completeKyb(origin, token, 'Resubmit Co', '11-2223334');
    await submitReview(origin, token); // first approval elevates to Controller + Owner

    // A later administrative change moves them off Owner; a re-submit must not re-assert it.
    authService.setUserRole(RESUBMIT_USER.email, {
      role: 'employee',
      approvalLimit: 0,
      isOwner: false,
    });
    await submitReview(origin, token);

    const session = authService.checkSession(token);
    expect(session).toMatchObject({ role: 'employee', isOwner: false });
  });
});
