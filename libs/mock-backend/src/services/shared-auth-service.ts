import { AuthService, type AuthServiceSnapshot } from './auth.service';

const STORAGE_KEY = 'clearline:mock-auth-state';

/**
 * sharedAuthService lives entirely inside the running JS bundle, so a full page navigation — the
 * same kind a real reset-password link triggers, or a manual tester gets by pasting a token URL
 * into the address bar — tore the bundle down and rebuilt this service from the seed fixtures,
 * silently discarding every reset token issued and password changed beforehand. That made a
 * freshly minted, valid reset token look expired the moment the page reloaded. Persisting a
 * snapshot to sessionStorage after every state-changing call, and restoring it on construction,
 * keeps state consistent across a reload the way a real backend's database would, while still
 * resetting between browser sessions (sessionStorage is cleared when the tab closes).
 */
export class PersistedAuthService extends AuthService {
  constructor() {
    super();
    this.hydrate();
  }

  private hydrate(): void {
    if (typeof sessionStorage === 'undefined') return;
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      this.restore(JSON.parse(saved) as AuthServiceSnapshot);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  private persist(): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot()));
  }

  override async login(...args: Parameters<AuthService['login']>) {
    const result = await super.login(...args);
    this.persist();
    return result;
  }

  override async requestPasswordReset(...args: Parameters<AuthService['requestPasswordReset']>) {
    const result = await super.requestPasswordReset(...args);
    this.persist();
    return result;
  }

  override async resetPassword(...args: Parameters<AuthService['resetPassword']>) {
    const result = await super.resetPassword(...args);
    this.persist();
    return result;
  }

  override async signUp(...args: Parameters<AuthService['signUp']>) {
    const result = await super.signUp(...args);
    this.persist();
    return result;
  }

  override async verifyEmail(...args: Parameters<AuthService['verifyEmail']>) {
    const result = await super.verifyEmail(...args);
    this.persist();
    return result;
  }

  override async refresh(...args: Parameters<AuthService['refresh']>) {
    const result = await super.refresh(...args);
    this.persist();
    return result;
  }

  override async logout(...args: Parameters<AuthService['logout']>) {
    await super.logout(...args);
    this.persist();
  }
}

/**
 * The one AuthService instance the running app's login and password-reset handlers both bind to
 * by default. Each handler module used to construct its own `new AuthService()`, which meant a
 * password reset mutated a user record the login handler's separate copy never saw — resetting
 * your password would appear to succeed, but the old password would keep working and the new one
 * would keep failing, since they read from different in-memory Maps seeded independently from
 * the same fixtures. Tests are unaffected: they pass their own isolated `AuthService` instance
 * into `createAuthHandlers`/`createPasswordResetHandlers` rather than relying on this default.
 */
export const sharedAuthService: AuthService = new PersistedAuthService();
