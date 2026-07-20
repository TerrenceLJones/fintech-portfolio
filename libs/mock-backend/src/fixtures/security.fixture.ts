import type { DeviceType } from '@clearline/contracts';
import { SEED_USERS } from './users.fixture';

/**
 * Seed state for the account-security surface (US-CW-035): per-user 2FA status, active device sessions,
 * and trusted-device exemptions. Kept in dedicated maps (deep-cloned into AuthService at construction)
 * rather than on SeedUser, so the service can mutate them freely without the shallow-copy aliasing that
 * `{ ...user }` would introduce for a nested object. All timestamps are fixed epochs relative to the
 * organization's deterministic creation time, so tests and demos are reproducible.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** A freshly-off 2FA record for lazily seeding a user created after construction (sign-up/invite). */
export function defaultTwoFactor(): StoredTwoFactor {
  return { enabled: false, secret: null, backupCodeHashes: [], pendingSecret: null };
}

/** Server-side 2FA state. The secret and backup-code hashes are never returned to the client. */
export interface StoredTwoFactor {
  enabled: boolean;
  /** Base32 TOTP secret once enabled, else null. */
  secret: string | null;
  /** SHA-256 hashes of the one-time backup codes — never the codes themselves (AC-06/AC-11). */
  backupCodeHashes: string[];
  /** A secret generated during an in-progress setup, not yet verified (AC-05). Null when idle. */
  pendingSecret: string | null;
}

/** Server-side active-session record; `lastActiveAt` is epoch ms, serialized to ISO by the service. */
export interface StoredDeviceSession {
  id: string;
  deviceType: DeviceType;
  browser: string;
  os: string;
  city: string;
  country: string;
  lastActiveAt: number;
  /** The session standing in for "this device" — its sign-out is disabled with a reason (AC-08). */
  current: boolean;
}

/** Server-side trusted-device exemption; timestamps are epoch ms. */
export interface StoredTrustedDevice {
  id: string;
  label: string;
  trustedAt: number;
  lastUsedAt: number;
}

/** The primary demo account — seeded with the richer, design-matching session/device set. */
const DEMO_EMAIL = SEED_USERS[0]!.email.toLowerCase();

/** Just the identity a seed builder needs — accepts the full SeedUser list the service was constructed with. */
interface Seedable {
  email: string;
}

export function seedTwoFactorByEmail(
  users: readonly Seedable[] = SEED_USERS,
): Map<string, StoredTwoFactor> {
  // Every seed account starts with 2FA OFF, so the guided enable flow (AC-03/04) is demoable directly.
  const map = new Map<string, StoredTwoFactor>();
  for (const user of users) {
    map.set(user.email.toLowerCase(), {
      enabled: false,
      secret: null,
      backupCodeHashes: [],
      pendingSecret: null,
    });
  }
  return map;
}

/** The lone current-device session every account starts with — reused when lazily seeding a new user. */
export function defaultCurrentSession(now: number): StoredDeviceSession {
  return {
    id: 'session_current',
    deviceType: 'desktop',
    browser: 'Chrome',
    os: 'macOS',
    city: 'San Francisco',
    country: 'US',
    lastActiveAt: now,
    current: true,
  };
}

// `now` defaults to construction time so relative "last active" copy reads freshly in the demo,
// while the fixed OFFSETS keep the sort order (and therefore every ordering assertion) deterministic.
export function seedDeviceSessionsByEmail(
  users: readonly Seedable[] = SEED_USERS,
  now: number = Date.now(),
): Map<string, StoredDeviceSession[]> {
  const map = new Map<string, StoredDeviceSession[]>();
  // Every user gets at least the current session, so no Security page shows an empty session list.
  for (const user of users) {
    map.set(user.email.toLowerCase(), [defaultCurrentSession(now)]);
  }
  // The demo account carries the three sessions drawn in design §19.4 (current + two others), so the
  // "sign out this device" and "sign out all other devices" flows (AC-08/09) are demoable out of the box.
  map.set(DEMO_EMAIL, [
    defaultCurrentSession(now),
    {
      id: 'session_firefox_win',
      deviceType: 'desktop',
      browser: 'Firefox',
      os: 'Windows',
      city: 'New York',
      country: 'US',
      lastActiveAt: now - 3 * HOUR_MS,
      current: false,
    },
    {
      id: 'session_ios_iphone',
      deviceType: 'mobile',
      browser: 'Clearline iOS app',
      os: 'iPhone',
      city: 'Austin',
      country: 'US',
      lastActiveAt: now - 1 * DAY_MS,
      current: false,
    },
  ]);
  return map;
}

export function seedTrustedDevicesByEmail(
  users: readonly Seedable[] = SEED_USERS,
  now: number = Date.now(),
): Map<string, StoredTrustedDevice[]> {
  const map = new Map<string, StoredTrustedDevice[]>();
  for (const user of users) {
    map.set(user.email.toLowerCase(), []);
  }
  // The demo account has one remembered device so the "Remove" flow (AC-10) is demoable directly.
  map.set(DEMO_EMAIL, [
    {
      id: 'trusted_macbook',
      label: 'Chrome on macOS · San Francisco',
      trustedAt: now - 20 * DAY_MS,
      lastUsedAt: now - 2 * DAY_MS,
    },
  ]);
  return map;
}
