// MSW v2 Node server entry point (Vitest / Playwright).
import { setupServer } from 'msw/node';
import { authHandlers } from './handlers/auth.handlers';
import { passwordResetHandlers } from './handlers/password-reset.handlers';
import { signUpHandlers } from './handlers/signup.handlers';
import { sessionHandlers } from './handlers/session.handlers';
import { onboardingHandlers } from './handlers/onboarding.handlers';
import { approvalsHandlers } from './handlers/approvals.handlers';
import { paymentsHandlers } from './handlers/payments.handlers';
import { expensesHandlers } from './handlers/expenses.handlers';
import { cardsHandlers, cardsFeedHandler } from './handlers/cards.handlers';
import { analyticsHandlers } from './handlers/analytics.handlers';
import { reconciliationHandlers } from './handlers/reconciliation.handlers';
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

export const server = setupServer(
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
);
