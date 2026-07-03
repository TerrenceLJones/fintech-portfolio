// MSW v2 browser worker entry point (dev server / Storybook).
import { setupWorker } from 'msw/browser';
import { authHandlers } from './handlers/auth.handlers';

export const worker = setupWorker(...authHandlers);
