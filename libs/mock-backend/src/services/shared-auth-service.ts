import { AuthService } from './auth.service';

/**
 * The one AuthService instance the running app's login and password-reset handlers both bind to
 * by default. Each handler module used to construct its own `new AuthService()`, which meant a
 * password reset mutated a user record the login handler's separate copy never saw — resetting
 * your password would appear to succeed, but the old password would keep working and the new one
 * would keep failing, since they read from different in-memory Maps seeded independently from
 * the same fixtures. Tests are unaffected: they pass their own isolated `AuthService` instance
 * into `createAuthHandlers`/`createPasswordResetHandlers` rather than relying on this default.
 */
export const sharedAuthService = new AuthService();
