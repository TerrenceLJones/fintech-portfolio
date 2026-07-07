import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersistedOnboardingService } from './shared-onboarding-service';

const STORAGE_KEY = 'clearline:mock-onboarding-state';
const KNOWN_EIN = '12-3456789';

const business = {
  legalName: 'Northwind Labs, Inc.',
  ein: KNOWN_EIN,
  structure: 'C-Corporation',
  addressLine1: '220 Mission St',
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94105',
};

/** Same rationale as shared-auth-service.test.ts's memory-storage stand-in — this package's test environment is `node`, which has no built-in sessionStorage. */
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

describe('PersistedOnboardingService', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    vi.stubGlobal('sessionStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('constructs without error when sessionStorage has no saved snapshot', () => {
    expect(() => new PersistedOnboardingService()).not.toThrow();
  });

  it('falls back to a clean state and clears the entry when sessionStorage holds corrupt JSON', () => {
    storage.setItem(STORAGE_KEY, 'not valid json{');

    expect(() => new PersistedOnboardingService()).not.toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('persists a snapshot to sessionStorage after submitBusinessInfo', async () => {
    const service = new PersistedOnboardingService();
    await service.submitBusinessInfo('user_1', business);

    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('persists a snapshot to sessionStorage after addOwner', async () => {
    const service = new PersistedOnboardingService();
    await service.addOwner('user_1', {
      firstName: 'Dara',
      lastName: 'Reyes',
      ownershipPercent: 60,
    });

    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('persists a snapshot to sessionStorage after completeStep', () => {
    const service = new PersistedOnboardingService();
    service.completeStep('user_1', 'business');

    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('persists a snapshot to sessionStorage after submitDocument', () => {
    const service = new PersistedOnboardingService();
    service.submitDocument('user_1', {
      ownerId: 'owner_1',
      fileName: 'drivers-license.jpg',
      mimeType: 'image/jpeg',
    });

    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('persists a snapshot to sessionStorage after submitReview', async () => {
    const service = new PersistedOnboardingService();
    await service.submitBusinessInfo('user_1', business);
    service.submitReview('user_1');

    const afterReview = storage.getItem(STORAGE_KEY);
    expect(afterReview).not.toBeNull();
    expect(JSON.parse(afterReview!).records[0][1].status).toBe('approved');
  });

  it('survives a simulated reload: state saved by one instance is readable by a fresh instance sharing the same sessionStorage', async () => {
    const before = new PersistedOnboardingService();
    await before.submitBusinessInfo('user_1', business);

    const after = new PersistedOnboardingService();
    expect(after.getStatus('user_1').business).toMatchObject({ ein: KNOWN_EIN });
  });
});
