// MSW v2 Node server entry point (Vitest / Playwright).
import { setupServer } from 'msw/node';
import { authHandlers } from './handlers/auth.handlers';

export const server = setupServer(...authHandlers);
