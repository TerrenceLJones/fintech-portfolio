import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createOnboardingHandlers } from './onboarding.handlers';
import { OnboardingService } from '../services/onboarding.service';
import { AuthService } from '../services/auth.service';
import { SEED_USERS, DEMO_USER_PASSWORD } from '../fixtures/users.fixture';

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
