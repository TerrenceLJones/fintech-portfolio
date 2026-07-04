import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersistedAuthService } from './shared-auth-service';

const STORAGE_KEY = 'clearline:mock-auth-state';
const NEW_PASSWORD = 'Brand-New-Password-1!';

/**
 * This package's test environment is `node` (see vitest.config.mts), which has no built-in
 * sessionStorage — a minimal in-memory stand-in implementing just the two methods
 * PersistedAuthService actually calls (getItem/setItem/removeItem) is enough to exercise its
 * hydrate/persist logic the way a real browser tab would.
 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('PersistedAuthService', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    vi.stubGlobal('sessionStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to seed data when sessionStorage has no saved snapshot', () => {
    expect(() => new PersistedAuthService()).not.toThrow();
  });

  it('falls back to seed data and clears the entry when sessionStorage holds corrupt JSON', () => {
    storage.setItem(STORAGE_KEY, 'not valid json{');

    expect(() => new PersistedAuthService()).not.toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('persists a snapshot to sessionStorage after login', async () => {
    const service = new PersistedAuthService();
    await service.login('demo@clearline.dev', 'wrong-password', '127.0.0.1');

    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('persists a snapshot to sessionStorage after signUp', async () => {
    const service = new PersistedAuthService();
    await service.signUp('new-owner@clearline.dev', NEW_PASSWORD);

    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('persists a snapshot to sessionStorage after verifyEmail', async () => {
    const service = new PersistedAuthService();
    const { verificationToken } = await service.signUp('new-owner@clearline.dev', NEW_PASSWORD);
    const beforeVerify = storage.getItem(STORAGE_KEY);

    await service.verifyEmail(verificationToken!);

    expect(storage.getItem(STORAGE_KEY)).not.toBe(beforeVerify);
  });

  it('survives a simulated reload: state signed up in one instance is readable by a fresh instance sharing the same sessionStorage', async () => {
    const before = new PersistedAuthService();
    const { verificationToken } = await before.signUp('new-owner@clearline.dev', NEW_PASSWORD);

    // A fresh instance, exactly what a page reload constructs — hydrate() must pick up the
    // snapshot the first instance persisted.
    const after = new PersistedAuthService();
    const result = await after.verifyEmail(verificationToken!);

    expect(result.outcome).toBe('success');
  });
});
