import { test, expect, type Page } from '@playwright/test';
import { fillLoginForm, expectSignedIn, navigateSpa } from './support/helpers';

const CONTROLLER_EMAIL = 'controller@clearline.dev';
const DEMO_PASSWORD = 'Correct-Horse-Battery-1';
const SHOTS = 'test-results/cards-verify';

async function loginAsController(page: Page) {
  await page.goto('/login');
  await fillLoginForm(page, CONTROLLER_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectSignedIn(page);
}

test('wallet lists cards and a card opens its live WebSocket feed (US-CW-014 AC-02)', async ({
  page,
}) => {
  await loginAsController(page);

  await navigateSpa(page, '/cards');
  await expect(page.getByText(/active · .*frozen/i)).toBeVisible();
  await expect(page.getByText('Dara Reyes — Design')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/1-wallet.png`, fullPage: true });

  // Clicking a tile opens the card; its feed connects over a REAL WebSocket to the MSW ws handler and
  // replays the backlog, deriving the remaining limit from authorized spend (never stored).
  await page.getByText('Dara Reyes — Design').first().click();
  await expect(page).toHaveURL(/\/cards\/card_4021/);
  await expect(page.getByText('DERIVED · READ-ONLY')).toBeVisible();
  await expect(page.getByText('Live · WebSocket')).toBeVisible();
  await expect(page.getByText('Amazon Web Services')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/2-detail-feed.png`, fullPage: true });
});

test('a Controller issues a card with a limit and MCC restrictions (US-CW-014 AC-01)', async ({
  page,
}) => {
  await loginAsController(page);

  await navigateSpa(page, '/cards');
  await page.getByRole('button', { name: /Issue card/i }).click();
  await expect(page).toHaveURL(/\/cards\/new/);
  await expect(page.getByText('New virtual card')).toBeVisible();

  await page.getByRole('button', { name: /Priya Nair/ }).click();
  await page.getByLabel('Monthly limit').fill('3000');
  await page.getByRole('button', { name: /^Software$/ }).click();
  await page.getByRole('button', { name: /^Issue card$/ }).click();

  // Lands on the newly issued card's detail feed — the derived panel is unique to the detail page.
  await expect(page).toHaveURL(/\/cards\/card_/);
  await expect(page.getByText('DERIVED · READ-ONLY')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/3-issued.png`, fullPage: true });
});

test('freeze stops authorizing and reads through icon + text (US-CW-014 AC-05)', async ({
  page,
}) => {
  await loginAsController(page);
  await navigateSpa(page, '/cards/card_4021');

  await expect(page.getByRole('button', { name: 'Freeze card' })).toBeVisible();
  await page.getByRole('button', { name: 'Freeze card' }).click();
  // The frozen state appears as an icon + "Frozen" label, and the control flips to Unfreeze.
  await expect(page.getByText('Frozen').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unfreeze card' })).toBeVisible();
  await expect(page.getByText(/New transactions are blocked/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/4-frozen.png`, fullPage: true });
});
