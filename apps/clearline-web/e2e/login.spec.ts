import { expect, test, type Page } from '@playwright/test';

// Window.__e2eMockBackend's type lives in e2e/global.d.ts, shared with src/main.tsx.

// Matches the seed user in libs/mock-backend/src/fixtures/users.fixture.ts
const DEMO_EMAIL = 'demo@clearline.dev';
const DEMO_PASSWORD = 'Correct-Horse-Battery-1';

async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByLabel('Work email').fill(email);
  // exact: true — otherwise this also matches the PasswordField's "Show password" toggle button,
  // whose aria-label contains "Password" as a substring (Playwright's getByLabel is substring
  // matching by default, unlike Testing Library's getByLabelText which is exact).
  await page.getByLabel('Password', { exact: true }).fill(password);
}

function waitForLoginResponse(page: Page) {
  return page.waitForResponse(
    (res) => res.url().includes('/api/auth/login') && res.request().method() === 'POST',
  );
}

test('an unauthenticated visitor is redirected to /login and back after signing in, with the access token kept out of storage (AC-01)', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page).toHaveURL(`${new URL(page.url()).origin}/login?next=%2F`);

  const loginResponse = waitForLoginResponse(page);
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  const { accessToken } = await (await loginResponse).json();
  expect(accessToken).toBeTruthy();

  await expect(page).toHaveURL(`${new URL(page.url()).origin}/`);
  await expect(page.getByText('Welcome back.')).toBeVisible();

  // access token must be held in memory only — never persisted to localStorage/sessionStorage.
  // The refresh-token cookie's httpOnly/Secure/SameSite=Strict contract is asserted at the
  // handler level (libs/mock-backend/src/handlers/auth.handlers.test.ts), not here: MSW's
  // browser-mode Service Worker can't make a real browser cookie or a visible set-cookie
  // response header, so there's nothing for Playwright to observe (verified — neither
  // context.cookies() nor response.allHeaders() surface it for this mocked login response).
  const storageDump = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(storageDump).not.toContain(accessToken);
});

test('invalid credentials show an inline error and clear the password field (AC-02)', async ({
  page,
}) => {
  await page.goto('/login');

  await fillLoginForm(page, DEMO_EMAIL, 'wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toContainText('Incorrect email or password');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page).toHaveURL(/\/login$/);
});

test('an unregistered email shows the same inline error, without revealing the account does not exist (AC-03)', async ({
  page,
}) => {
  await page.goto('/login');

  await fillLoginForm(page, 'not-a-real-user@clearline.dev', 'whatever-password-1');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toContainText('Incorrect email or password');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page).toHaveURL(/\/login$/);
});

test('5 failed attempts within 15 minutes locks the account and surfaces a support reference (AC-04)', async ({
  page,
}) => {
  await page.goto('/login');

  // Lockout tracking is keyed by attempted email regardless of registration (see US-CW-001's
  // technical_notes), so an unregistered email is used here to exercise that enumeration-safety
  // guarantee rather than reusing the seeded demo account.
  const email = 'lockout-test@clearline.dev';

  for (let attempt = 0; attempt < 4; attempt += 1) {
    // Gate on the actual response, not on the repeated "Incorrect email or password" text — that
    // text is identical across attempts, so waiting on it would resolve against the *previous*
    // attempt's still-visible alert and race ahead of the network round trip. A click that lands
    // while the button is still loading is silently swallowed (Button.tsx preventDefaults it), so
    // racing ahead here would under-count attempts and never reach the 5th, lockout-triggering one.
    const response = waitForLoginResponse(page);
    await fillLoginForm(page, email, 'wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await response;
  }

  // the 5th failed attempt itself trips the lockout
  await fillLoginForm(page, email, 'wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(
    page.getByText(
      'Your account is temporarily locked for your protection. Contact support to restore access.',
    ),
  ).toBeVisible();
  await expect(page.getByText(/Reference: SR-[A-F0-9]{8}/)).toBeVisible();
});

test('an unreachable auth service retries automatically, then offers a manual retry (AC-05)', async ({
  page,
}) => {
  // Real exponential backoff (1s/2s/4s ≈ 7s across 3 retries) runs in this test, unlike the unit
  // tests which inject retryDelayMs: () => 0 — give this test headroom beyond the 30s default.
  test.setTimeout(45_000);

  let responseCount = 0;
  page.on('response', (res) => {
    if (res.url().includes('/api/auth/login')) responseCount += 1;
  });

  await page.goto('/login');
  // MSW's Service Worker answers /api/auth/login in-process, so Playwright's page.route() can't
  // intercept it to force a failure (confirmed — a forced-500 route silently never fires, and the
  // real mocked response goes through instead). This dev-only hook overrides the handler from
  // inside the page's own MSW instance; see libs/mock-backend/src/browser.ts. It's attached
  // asynchronously during bootstrap (after worker.start() resolves), which lands after Playwright
  // considers page.goto() complete, so wait for it rather than assuming it's already there.
  await page.waitForFunction(() => window.__e2eMockBackend !== undefined);
  await page.evaluate(() => window.__e2eMockBackend!.simulateLoginFailure());

  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Something went wrong on our end. Retrying…')).toBeVisible();

  const tryAgainButton = page.getByRole('button', { name: 'Try again' });
  await expect(tryAgainButton).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Something went wrong on our end.', { exact: true })).toBeVisible();
  expect(responseCount).toBe(4); // 1 initial attempt + 3 retries

  // clicking "Try again" re-submits against the same simulated failure, cycling back through the
  // retry sequence to the same manual-retry affordance
  await tryAgainButton.click();
  await expect(page.getByText('Something went wrong on our end. Retrying…')).toBeVisible();
  await expect(tryAgainButton).toBeVisible({ timeout: 15_000 });
  expect(responseCount).toBe(8);
});
