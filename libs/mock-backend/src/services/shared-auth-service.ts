import { AuthService, type AuthServiceSnapshot } from './auth.service';

const STORAGE_KEY = 'clearline:mock-auth-state';

/**
 * Bump whenever AuthServiceSnapshot's shape changes. A snapshot persisted by an older build — e.g. one
 * predating the org/team fields (orgId on SeedUser, the organizations/inviteTokens maps) — is
 * discarded on load rather than restored into an inconsistent state. Without this, a stale snapshot
 * would rehydrate users with no orgId, so the team roster still renders (from an earlier fetch) but a
 * role/removal PATCH 404s because the member can no longer be matched to an org.
 */
const SNAPSHOT_VERSION = 2;

interface VersionedSnapshot {
  version: number;
  snapshot: AuthServiceSnapshot;
}

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
      const parsed = JSON.parse(saved) as Partial<VersionedSnapshot>;
      // Discard anything not written by this exact snapshot version — an older, shape-incompatible
      // snapshot (or a pre-versioning bare snapshot) reseeds fresh from the fixtures instead.
      if (parsed.version !== SNAPSHOT_VERSION || !parsed.snapshot) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      this.restore(parsed.snapshot);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  private persist(): void {
    if (typeof sessionStorage === 'undefined') return;
    const payload: VersionedSnapshot = { version: SNAPSHOT_VERSION, snapshot: this.snapshot() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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

  override setUserRole(...args: Parameters<AuthService['setUserRole']>) {
    super.setUserRole(...args);
    this.persist();
  }

  override provisionOrganizationForOwner(
    ...args: Parameters<AuthService['provisionOrganizationForOwner']>
  ) {
    const result = super.provisionOrganizationForOwner(...args);
    this.persist();
    return result;
  }

  override async createInvite(...args: Parameters<AuthService['createInvite']>) {
    const result = await super.createInvite(...args);
    this.persist();
    return result;
  }

  override async acceptInvite(...args: Parameters<AuthService['acceptInvite']>) {
    const result = await super.acceptInvite(...args);
    this.persist();
    return result;
  }

  override async resendInvite(...args: Parameters<AuthService['resendInvite']>) {
    const result = await super.resendInvite(...args);
    this.persist();
    return result;
  }

  override revokeInvite(...args: Parameters<AuthService['revokeInvite']>) {
    const result = super.revokeInvite(...args);
    this.persist();
    return result;
  }

  override changeMemberRole(...args: Parameters<AuthService['changeMemberRole']>) {
    const result = super.changeMemberRole(...args);
    this.persist();
    return result;
  }

  override removeMember(...args: Parameters<AuthService['removeMember']>) {
    const result = super.removeMember(...args);
    this.persist();
    return result;
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
