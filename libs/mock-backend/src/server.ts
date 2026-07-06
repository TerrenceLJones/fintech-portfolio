// MSW v2 Node server entry point (Vitest / Playwright).
import { setupServer } from 'msw/node';
import { authHandlers } from './handlers/auth.handlers';
import { passwordResetHandlers } from './handlers/password-reset.handlers';
import { signUpHandlers } from './handlers/signup.handlers';
import { sessionHandlers } from './handlers/session.handlers';

export const server = setupServer(
  ...authHandlers,
  ...passwordResetHandlers,
  ...signUpHandlers,
  ...sessionHandlers,
);
