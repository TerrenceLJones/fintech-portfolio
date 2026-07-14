import type { Money } from '@clearline/contracts';
import { formatMoneyValue } from '@clearline/ui';
import { SEED_USERS } from '@clearline/mock-backend/fixtures';

/** The seeded demo account every scenario acts on. */
export const DEMO_EMAIL = SEED_USERS[0]!.email;

/**
 * Format a minor-units Money value for display in beacon config, via the same currency-aware
 * formatter the app now uses (US-CW-008 money-utils refactor).
 */
export function money(m: Money): string {
  return formatMoneyValue(m);
}

/**
 * Lazily load the mock-backend browser entry (the `simulate*` controls). A dynamic import so the
 * MSW/worker code stays in its own chunk and is only fetched when a scenario button runs.
 */
export const loadControls = () => import('@clearline/mock-backend/browser');
