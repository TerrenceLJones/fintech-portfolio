// MSW v2 browser worker entry point (dev server / Storybook).
import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import type { Role, SessionErrorCode } from '@clearline/contracts';
import { authHandlers } from './handlers/auth.handlers';
import { passwordResetHandlers } from './handlers/password-reset.handlers';
import { signUpHandlers } from './handlers/signup.handlers';
import { sessionHandlers } from './handlers/session.handlers';
import { onboardingHandlers } from './handlers/onboarding.handlers';
import { approvalsHandlers } from './handlers/approvals.handlers';
import { paymentsHandlers } from './handlers/payments.handlers';
import { expensesHandlers } from './handlers/expenses.handlers';
import { cardsHandlers, cardsFeedHandler } from './handlers/cards.handlers';
import {
  analyticsHandlers,
  isAnalyticsSectionFailureArmed,
  setAnalyticsSectionFailure,
  type AnalyticsSection,
} from './handlers/analytics.handlers';
import {
  reconciliationHandlers,
  isReconciliationSectionFailureArmed,
  setReconciliationSectionFailure,
  type ReconciliationSection,
} from './handlers/reconciliation.handlers';
import { budgetsHandlers } from './handlers/budgets.handlers';
import { auditHandlers } from './handlers/audit.handlers';
import { teamHandlers } from './handlers/team.handlers';
import { settingsHandlers } from './handlers/settings.handlers';
import { profileHandlers } from './handlers/profile.handlers';
import { securityHandlers } from './handlers/security.handlers';
import { companyHandlers } from './handlers/company.handlers';
import { policiesHandlers } from './handlers/policies.handlers';
import { cardProgramHandlers } from './handlers/card-program.handlers';
import { connectedAccountsHandlers } from './handlers/connected-accounts.handlers';
import { integrationsHandlers } from './handlers/integrations.handlers';
import { orgNotificationsHandlers } from './handlers/org-notifications.handlers';
import { orgSecurityHandlers } from './handlers/org-security.handlers';
import { developerHandlers } from './handlers/developer.handlers';
import { billingHandlers } from './handlers/billing.handlers';
import { sharedIntegrationsService } from './services/shared-integrations-service';
import { sharedAnalyticsService } from './services/shared-analytics-service';
import { sharedReconciliationService } from './services/shared-reconciliation-service';
import { sharedBudgetsService } from './services/shared-budgets-service';
import { sharedAuthService } from './services/shared-auth-service';
import { sharedCardsService } from './services/shared-cards-service';
import {
  DEMO_LIMIT_DECLINE_CHARGE,
  DEMO_LIVE_CHARGE,
  DEMO_MCC_DECLINE_CHARGE,
  DEMO_SECURITY_DECLINE_CHARGE,
} from './fixtures/cards.fixture';
import { sharedOnboardingService } from './services/shared-onboarding-service';
import { sharedPaymentsService } from './services/shared-payments-service';
import { DEMO_ONBOARDED_BUSINESS } from './fixtures/onboarding.fixture';
import { SEED_ORGANIZATION, SEED_USERS } from './fixtures/users.fixture';

export const worker = setupWorker(
  ...authHandlers,
  ...passwordResetHandlers,
  ...signUpHandlers,
  ...sessionHandlers,
  ...onboardingHandlers,
  ...approvalsHandlers,
  ...paymentsHandlers,
  ...expensesHandlers,
  ...cardsHandlers,
  cardsFeedHandler,
  ...analyticsHandlers,
  ...reconciliationHandlers,
  ...budgetsHandlers,
  ...auditHandlers,
  ...teamHandlers,
  ...settingsHandlers,
  ...profileHandlers,
  ...securityHandlers,
  ...companyHandlers,
  ...policiesHandlers,
  ...cardProgramHandlers,
  ...connectedAccountsHandlers,
  ...integrationsHandlers,
  ...orgNotificationsHandlers,
  ...orgSecurityHandlers,
  ...developerHandlers,
  ...billingHandlers,
);

// Seed the demo user as an already-approved, fully-onboarded business so signing in as it lands on
// the dashboard rather than the onboarding wizard (US-CW-004 AC-09/AC-10). This lives in the
// browser (dev/e2e) entry point only — the Node MSW server (server.ts) never loads it, so unit and
// component tests keep constructing fresh, seed-free OnboardingService instances. No-op if a record
// already exists, e.g. one rehydrated from sessionStorage after a dev-server reload.
// Seed every role account as an already-approved, fully-onboarded business so signing in as any of
// them lands on its role-based home rather than the onboarding wizard (US-CW-004 AC-09/AC-10). They
// share one demo business — the point is to tour the role-scoped shells, not distinct orgs.
for (const seedUser of SEED_USERS) {
  sharedOnboardingService.seedApprovedAccount(seedUser.id, DEMO_ONBOARDED_BUSINESS);
}

/**
 * Test/demo override for AC-05 (auth-service-unreachable retry/backoff) — see
 * apps/clearline-web/e2e/login.spec.ts and the login Beacon's "auth outage" toggle. Only reachable
 * via the window hook main.tsx wires up (e2e) or the dev-only Beacon (demo), so it never ships to
 * production. Playwright's page.route() can't intercept /api/auth/login itself: MSW's Service Worker
 * answers it in-process without a real network transaction, so there's nothing for CDP-level route
 * interception to catch.
 *
 * A single persistent runtime handler (registered once, below) reads this flag on each login: when
 * armed it returns a 500, and when disarmed it returns nothing so the request falls through to the
 * real auth handler. That flip-a-flag design is what lets the Beacon toggle the outage back OFF —
 * the previous one-shot `worker.use(...)` override could only ever be added, never removed.
 */
let loginFailureArmed = false;

worker.use(
  http.post('*/api/auth/login', () =>
    loginFailureArmed ? HttpResponse.json({ error: 'internal_error' }, { status: 500 }) : undefined,
  ),
);

/** Arm or disarm the simulated auth outage. */
export function setLoginFailure(armed: boolean): void {
  loginFailureArmed = armed;
}

/** Current auth-outage state — lets the Beacon toggle reflect reality when the panel reopens. */
export function isLoginFailureArmed(): boolean {
  return loginFailureArmed;
}

/** Back-compat one-shot arm for the AC-05 e2e test, which only ever needs to turn the outage on. */
export function simulateLoginFailure(): void {
  setLoginFailure(true);
}

/**
 * Test-only bypass for e2e coverage of the password-reset flow — see
 * apps/clearline-web/e2e/password-reset.spec.ts. AC-01 deliberately makes the forgot-password
 * response identical regardless of whether the email is registered, so the reset token it issues
 * is unrecoverable from the HTTP response by design; in production it only ever reaches the user
 * through an emailed link, and there is no inbox for Playwright to read. This mints a second,
 * independently valid token through the same `sharedAuthService` the real handlers use — issuing
 * a token doesn't invalidate any other outstanding one for that email — so it stands in for "the
 * token from the email" without adding a test-only branch to the request-handling code path.
 * Resolves `undefined` for an unregistered email, exactly like the real flow.
 */
export async function issueResetTokenForE2E(email: string): Promise<string | undefined> {
  const { token } = await sharedAuthService.requestPasswordReset(email);
  return token;
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Same as `issueResetTokenForE2E`, but backdated 1 minute past the 1-hour TTL so it's already
 * expired the moment it's issued — for AC-02 e2e coverage. There's no clock-travel hook to age a
 * real token, and `page.route()` can't force a different `/reset-password/validate` response for
 * the same MSW-interception-can't-be-intercepted reason `simulateLoginFailure` exists for login.
 */
export async function issueExpiredResetTokenForE2E(email: string): Promise<string | undefined> {
  const { token } = await sharedAuthService.requestPasswordReset(
    email,
    Date.now() - RESET_TOKEN_TTL_MS - 60_000,
  );
  return token;
}

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Test-only bypass for e2e coverage of the sign-up flow — see apps/clearline-web/e2e/signup.spec.ts.
 * Same rationale as issueResetTokenForE2E: AC-01's verification token never appears in the HTTP
 * response, only in an email there's no inbox for Playwright to read. Calling signUp again for an
 * email that already has an unverified account (the one the real UI flow just created) mints a
 * second, independently valid token for that same account rather than creating a duplicate one —
 * see AuthService.signUp's "already registered but NOT verified" branch. Resolves `undefined` if
 * the email is already verified, since there's nothing left to verify.
 */
export async function issueVerificationTokenForE2E(
  email: string,
  password: string,
): Promise<string | undefined> {
  const { verificationToken } = await sharedAuthService.signUp(email, password);
  return verificationToken;
}

/**
 * Same as `issueVerificationTokenForE2E`, but backdated 1 minute past the 24-hour TTL so it's
 * already expired the moment it's issued — for AC-05 e2e coverage.
 */
export async function issueExpiredVerificationTokenForE2E(
  email: string,
  password: string,
): Promise<string | undefined> {
  const { verificationToken } = await sharedAuthService.signUp(
    email,
    password,
    Date.now() - VERIFICATION_TOKEN_TTL_MS - 60_000,
  );
  return verificationToken;
}

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Dev/demo + e2e control for US-CW-031: mints a real team invite into the seeded demo organization
 * and hands back the single-use token, standing in for the emailed invite link there's no inbox to
 * read (same rationale as issueResetTokenForE2E/issueVerificationTokenForE2E). Lets a tester walk the
 * accept flow — set a password, land straight on the role dashboard — from the Team Beacon. Resolves
 * undefined if the email is already a member (no token minted). Behind import.meta.env.DEV.
 */
export async function issueInviteTokenForE2E(
  email: string,
  role: Role = 'finance_manager',
  grantAdmin = false,
): Promise<string | undefined> {
  const { token } = await sharedAuthService.createInvite({
    orgId: SEED_ORGANIZATION.id,
    email,
    role,
    grantAdmin,
    inviterName: 'Priya Nair',
  });
  return token;
}

/**
 * Same as issueInviteTokenForE2E, but backdated 1 minute past the 7-day TTL so it's already expired —
 * for US-CW-031 AC-03 coverage of the "This invite has expired" screen. Behind import.meta.env.DEV.
 */
export async function issueExpiredInviteTokenForE2E(
  email: string,
  role: Role = 'finance_manager',
): Promise<string | undefined> {
  const { token } = await sharedAuthService.createInvite(
    { orgId: SEED_ORGANIZATION.id, email, role, grantAdmin: false, inviterName: 'Priya Nair' },
    Date.now() - INVITE_TOKEN_TTL_MS - 60_000,
  );
  return token;
}

/**
 * Test-only bypass for US-CW-002 AC-01 e2e coverage: there's no way to fast-forward a real
 * browser's clock, so this backdates the signed-in account's access token(s) directly via
 * AuthService rather than waiting out the real TTL. The refresh-token cookie is left untouched,
 * so the very next authenticated request should 401 with access_token_expired and the app's
 * silent-refresh interceptor should recover it transparently.
 */
export function expireAccessTokenForE2E(email: string): void {
  sharedAuthService.expireAccessTokensForE2E(email);
}

export type SimulatedRefreshOutcome = 'success' | 'reused' | 'expired' | 'password_changed';

/**
 * Test-only override of POST /api/auth/refresh for e2e coverage of US-CW-002 AC-01 (success),
 * AC-02 (reused), AC-03 (expired) and AC-06 (password_changed)'s client-side reaction to each
 * outcome — same worker.use() override pattern as simulateLoginFailure, and for the same
 * page.route()-can't-intercept-an-in-process-Service-Worker reason.
 *
 * This exists because the real family/token bookkeeping (AuthService.refresh) can't be exercised
 * through an actual browser round trip here: `Set-Cookie` is a forbidden response header per the
 * Fetch spec, so browsers never apply it from a Service Worker's synthetic Response — confirmed
 * empirically (document.cookie and page.context().cookies() are both empty after login in a real
 * Playwright/Chromium run) — meaning the refresh-token cookie the login handler "sets" never
 * actually reaches the browser's cookie jar, and every subsequent request that would normally
 * carry it sends none at all. That bookkeeping is already thoroughly covered where MSW's Node
 * interceptor doesn't have this restriction: auth.service.session.test.ts (unit) and
 * session.handlers.test.ts (Node-http integration, via a real shared cookie jar). This hook lets
 * e2e instead verify what it uniquely can: that the app's own interceptor and UI correctly react
 * to each server outcome in a real browser.
 *
 * `email` is only used for the 'success' outcome — it identifies which account's family to mint
 * a properly-registered replacement access token against (see AuthService.mintAccessTokenForE2E),
 * since a bare random string wouldn't pass the very next checkSession() call the app makes.
 */
export function simulateRefreshOutcomeForE2E(
  outcome: SimulatedRefreshOutcome,
  email: string,
): void {
  if (outcome === 'success') {
    worker.use(
      http.post('*/api/auth/refresh', () =>
        HttpResponse.json({ accessToken: sharedAuthService.mintAccessTokenForE2E(email) }),
      ),
    );
    return;
  }

  const error: SessionErrorCode =
    outcome === 'reused'
      ? 'session_revoked_security'
      : outcome === 'password_changed'
        ? 'session_revoked_password_changed'
        : 'session_expired';

  worker.use(http.post('*/api/auth/refresh', () => HttpResponse.json({ error }, { status: 401 })));
}

/**
 * Dev/e2e control for US-CW-006: changes the signed-in demo account's role/limit/admin flag in
 * place, standing in for an admin reassigning it in another surface. Because checkSession re-reads
 * the live user record on every request, the app's next session refetch reflects the new role — the
 * "next request" AC-05 hangs on — hiding now-unauthorized nav and features without a re-login. Also
 * how the demo tours all three shells (Employee / Finance Manager / Controller) from one account.
 * Reachable only via the window hook main.tsx wires up behind import.meta.env.DEV, so it never ships.
 */
export function simulateRoleChangeForE2E(
  email: string,
  patch: { role?: Role; approvalLimit?: number | null; isAdmin?: boolean; isOwner?: boolean },
): void {
  sharedAuthService.setUserRole(email, patch);
}

/**
 * Dev/e2e control for US-CW-009 AC-02: stands in for the bank's reversal webhook, which has no real
 * sender here. Posts an additive reversing ledger entry against the given intent (the original entry
 * is never edited) and flips its status to "Reversed", so the transaction-detail view can be driven
 * to the reversed state. Reachable only via the window hook main.tsx wires up behind
 * import.meta.env.DEV, so it never ships.
 */
export function simulatePaymentReversalForE2E(intentId: string): void {
  sharedPaymentsService.reverse(intentId);
}

/**
 * Dev/demo control for US-CW-014 AC-02: streams an in-policy $150 Notion Labs authorization onto a
 * card's live feed. Because the card's remaining limit is derived from authorized spend, the number
 * visibly moves the moment this lands. Reachable only via the demo Beacon (behind import.meta.env.DEV),
 * so it never ships — the demo has no real card network to originate authorizations.
 */
export function simulateCardChargeForE2E(cardId: string): void {
  sharedCardsService.authorizeTransaction(cardId, { ...DEMO_LIVE_CHARGE });
}

/** The kinds of decline the demo can stage, each mapping to one acceptance criterion. */
export type CardDeclineKind = 'mcc' | 'limit' | 'security';

/**
 * Dev/demo control for the three decline scenarios (US-CW-014 AC-03/AC-04/AC-07):
 *   - 'mcc'      → a Restaurants charge on a Software/Office-only card (category block).
 *   - 'limit'    → a charge $25 over the card's remaining derived limit (guaranteed insufficient-limit).
 *   - 'security' → a charge on a card flagged lost/stolen, so the true reason is recorded but the
 *                  cardholder only ever sees the generic message.
 * Each streams a declined row onto the feed; none moves the limit. Demo-only, behind import.meta.env.DEV.
 */
export function simulateCardDeclineForE2E(cardId: string, kind: CardDeclineKind): void {
  if (kind === 'mcc') {
    sharedCardsService.authorizeTransaction(cardId, { ...DEMO_MCC_DECLINE_CHARGE });
    return;
  }
  if (kind === 'security') {
    sharedCardsService.authorizeTransaction(cardId, {
      ...DEMO_SECURITY_DECLINE_CHARGE,
      securityHold: 'lost_or_stolen',
    });
    return;
  }
  // 'limit': force the charge above whatever headroom the card currently has so it always declines.
  const card = sharedCardsService.getCard(cardId);
  const remaining = card
    ? card.monthlyLimit.amountMinorUnits - card.authorizedSpend.amountMinorUnits
    : 0;
  sharedCardsService.authorizeTransaction(cardId, {
    ...DEMO_LIMIT_DECLINE_CHARGE,
    amountMinorUnits: Math.max(DEMO_LIMIT_DECLINE_CHARGE.amountMinorUnits, remaining + 2_500),
  });
}

/**
 * Dev/demo control for US-CW-014 AC-06: force-closes the card's live feed socket so the client shows
 * its "Reconnecting…" banner and reconnects with exponential backoff. Demo-only, behind import.meta.env.DEV.
 */
export function simulateCardFeedDropForE2E(cardId: string): void {
  sharedCardsService.dropFeed(cardId);
}

/**
 * Dev/demo control for US-CW-015 AC-05: arms/disarms a 500 on a single dashboard section (e.g.
 * "top-vendors") so a viewer can watch it fail behind its own error boundary while every other
 * section renders and retries independently. A persistent flag the Beacon toggle mirrors and can
 * turn back OFF. Demo-only, behind import.meta.env.DEV.
 */
export function setAnalyticsSectionFailureForE2E(section: AnalyticsSection, armed: boolean): void {
  setAnalyticsSectionFailure(section, armed);
}

/** Current armed state of a section's simulated failure — lets the Beacon toggle mirror reality when it reopens. */
export function isAnalyticsSectionFailureArmedForE2E(section: AnalyticsSection): boolean {
  return isAnalyticsSectionFailureArmed(section);
}

/**
 * Dev/demo control for US-CW-015 AC-06: backdates the dashboard's freshness stamp by `minutes` so the
 * "Last updated N minutes ago" stale indicator and manual Refresh are visible without waiting. The
 * next Refresh (or a real refetch) restamps it to now. Demo-only, behind import.meta.env.DEV.
 */
export function backdateAnalyticsRefreshForE2E(minutes = 10): void {
  sharedAnalyticsService.backdateRefresh(minutes);
}

/**
 * Dev/demo control for US-CW-016 AC-05: arms/disarms a 500 on a single reconciliation panel (e.g.
 * "exceptions") so a viewer can watch it fail behind its own error boundary while the summary, matched
 * and balance panels render independently. A persistent flag the Beacon toggle mirrors and can turn
 * back OFF. Demo-only, behind import.meta.env.DEV.
 */
export function setReconciliationSectionFailureForE2E(
  section: ReconciliationSection,
  armed: boolean,
): void {
  setReconciliationSectionFailure(section, armed);
}

/** Current armed state of a reconciliation panel's simulated failure — lets the Beacon toggle mirror reality. */
export function isReconciliationSectionFailureArmedForE2E(section: ReconciliationSection): boolean {
  return isReconciliationSectionFailureArmed(section);
}

/**
 * Dev/demo control for US-CW-016 AC-04: arms/disarms the ledger balance-integrity discrepancy so a
 * viewer can see the Fatal-tier "we're double-checking your balance" state — the balance withheld,
 * only a support reference shown — instead of the normal number. Demo-only, behind import.meta.env.DEV.
 */
export function setReconciliationBalanceFailureForE2E(armed: boolean): void {
  sharedReconciliationService.setBalanceIntegrityFailure(armed);
}

/** Current armed state of the balance-integrity discrepancy — lets the Beacon toggle mirror reality. */
export function isReconciliationBalanceFailureArmedForE2E(): boolean {
  return sharedReconciliationService.isBalanceIntegrityFailureArmed();
}

/** Re-run the nightly reconciliation on demand — the "Run again" control's demo/e2e entry point. */
export function runReconciliationForE2E(): void {
  sharedReconciliationService.runReconciliation();
}

/**
 * Dev/demo control for US-CW-019 AC-02: pushes a department to exactly its 80% warning threshold,
 * standing in for the transaction that trips it — there's no real card network accruing spend here.
 * Records the one-time stakeholder notification for the period, so the overview gauge flips to its
 * amber "80% of budget used" state with the "Stakeholders notified" chip. Refresh the overview to see
 * it. Demo-only, behind import.meta.env.DEV.
 */
export function simulateBudgetThresholdCrossingForE2E(department?: string): void {
  sharedBudgetsService.simulateThresholdCrossing(department);
}

/**
 * Dev/demo control for US-CW-019 AC-04: ends the current budget period and begins the next, standing in
 * for the scheduled midnight-of-month-end rollover job that a frontend demo can't run. Every
 * department's new period starts at $0.00 spent while prior periods stay readable in Budget history.
 * Refresh the overview/history to see it. Demo-only, behind import.meta.env.DEV.
 */
export function simulateBudgetRolloverForE2E(): void {
  sharedBudgetsService.rolloverPeriod();
}

const EMAIL_CHANGE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Dev/demo + e2e control for US-CW-034 AC-03/04: begins a verified email change for the signed-in
 * account and hands back the single-use token, standing in for the emailed confirmation link there's
 * no inbox to read (same rationale as issueResetTokenForE2E / issueVerificationTokenForE2E). Lets the
 * Personal Info Beacon open the confirm link and watch the login email swap. Resolves undefined if the
 * change was rejected (malformed / same-as-current / already-taken). Behind import.meta.env.DEV.
 */
export async function issueEmailChangeTokenForE2E(
  email: string,
  newEmail: string,
): Promise<string | undefined> {
  const { token } = await sharedAuthService.requestEmailChange(email, newEmail);
  return token;
}

/**
 * Same as issueEmailChangeTokenForE2E, but backdated 1 minute past the 24-hour TTL so it's already
 * expired the moment it's issued — for AC-04 coverage of the "This link has expired" screen.
 * Behind import.meta.env.DEV.
 */
export async function issueExpiredEmailChangeTokenForE2E(
  email: string,
  newEmail: string,
): Promise<string | undefined> {
  const { token } = await sharedAuthService.requestEmailChange(
    email,
    newEmail,
    Date.now() - EMAIL_CHANGE_TOKEN_TTL_MS - 60_000,
  );
  return token;
}

/**
 * Demo/e2e control for US-CW-039 AC-04: push a connected accounting integration into the `error`
 * state so the IntegrationCard's "Error" badge and Reconnect action are exercisable without waiting
 * for a real sync failure. Scoped to the demo org. Behind import.meta.env.DEV via the Beacon.
 */
export function forceIntegrationSyncErrorForE2E(
  provider: 'quickbooks' | 'xero' | 'netsuite',
): void {
  sharedIntegrationsService.forceSyncError(SEED_ORGANIZATION.id, provider);
}
