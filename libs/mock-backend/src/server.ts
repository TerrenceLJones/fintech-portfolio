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
);
