import type { NotificationPreference, Role } from '@clearline/contracts';

export interface SeedUser {
  id: string;
  email: string;
  /** PBKDF2-HMAC-SHA256 hash (see @clearline/domain-auth password-hashing) — never plaintext, even in seed data. */
  passwordHash: string;
  /** False from account creation (US-CW-029 AC-01) until the sign-up verification link is clicked (AC-03). */
  verified: boolean;
  /** Human-readable name for the nav sidebar/avatar (US-CW-006). */
  displayName: string;
  /** Approval-tier role — decides the permission set, re-read on every session check (US-CW-006). */
  role: Role;
  /** Approval limit in minor units; null = unlimited (Controller). */
  approvalLimit: number | null;
  /** Orthogonal to the approval tier — grants team:view only, never approval authority. */
  isAdmin: boolean;
  /**
   * The account creator, elevated to Owner when their business clears KYB (US-CW-030). Orthogonal to
   * both the approval tier and isAdmin. Grants `team:view` (like isAdmin) and is a protected per-org
   * singleton — non-removable and non-self-demotable (US-CW-030 AC-03, enforced in AuthService).
   */
  isOwner: boolean;
  /**
   * The Organization this user belongs to (US-CW-030). Null until they either have a business approved
   * (which provisions an org and makes them its Owner) or accept an invite into an existing org
   * (US-CW-031) — a freshly signed-up account has none.
   */
  orgId: string | null;
  /** Epoch ms the user joined their organization — the roster's "joined" column (Design §18.1). */
  joinedAt: number;
  // --- Personal profile (US-CW-034). All optional; the service coalesces undefined to null/defaults
  // so pre-existing fixtures and tests that construct a SeedUser need no change. ---
  /** Contact phone, self-managed on Personal Info. */
  phone?: string | null;
  /** Job title, self-managed on Personal Info. */
  jobTitle?: string | null;
  /** Data URL of the uploaded avatar; undefined/null falls back to the initials avatar (AC-06). */
  avatarUrl?: string | null;
  /** A new login email awaiting confirmation (AC-03); undefined/null when none is outstanding. */
  pendingEmail?: string | null;
  /** Per-notification channel/frequency preferences; undefined defaults to defaultNotificationPrefs(). */
  notificationPrefs?: NotificationPreference[];
}

/** The plaintext DEMO_USER_PASSWORD was hashed from, kept only so local dev/tests can log in as the seed user. */
export const DEMO_USER_PASSWORD = 'Correct-Horse-Battery-1';

/**
 * The PBKDF2 hash of DEMO_USER_PASSWORD. Every seed account shares this one password so a tester can
 * sign in as any role with the same credentials shown in the login guide — only the email differs.
 */
const DEMO_PASSWORD_HASH =
  'pbkdf2-sha256$210000$EVdpGm+5ZSyaf/tp5qNqAA==$2HU7zHF8PxFivV/4XCZ8GGQeUpHl/B71IO6/yMl3ZhM=';

/**
 * The one demo Organization every seed user belongs to (US-CW-030). Keyed to the same business the
 * demo accounts onboarded (DEMO_ONBOARDED_BUSINESS's EIN), so the Team roster (Design §18.1) has a
 * real, populated org to show. Its Owner is the dedicated `owner@clearline.dev` account below.
 */
export const SEED_ORGANIZATION = {
  id: 'org_clearline_demo',
  legalName: 'Clearline Demo Co',
  ein: '11-2223334',
  /** Fixed epoch (2026-04-01T00:00:00Z) so seed data is deterministic across test runs. */
  createdAt: 1_743_465_600_000,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deterministic seed users for local dev/demo and tests — never real credentials. One account per
 * approval-tier role so a tester can sign in as each and see its role-scoped shell and role-based
 * home (US-CW-006 / US-CW-001): the Employee lands on My Expenses, the approvers on the queue. The
 * Finance Manager (index 0, `demo@clearline.dev`) is the primary demo account e2e signs in as; its
 * role can still be switched mid-session via simulateRoleChangeForE2E. The dedicated Owner account
 * (`owner@clearline.dev`) is the one that can reach the Team surface (US-CW-031). All belong to
 * SEED_ORGANIZATION and share DEMO_USER_PASSWORD.
 */
export const SEED_USERS: SeedUser[] = [
  {
    id: 'user_1',
    email: 'demo@clearline.dev',
    passwordHash: DEMO_PASSWORD_HASH,
    verified: true,
    displayName: 'Marcus Okafor',
    role: 'finance_manager',
    approvalLimit: 1_000_000,
    isAdmin: false,
    isOwner: false,
    orgId: SEED_ORGANIZATION.id,
    joinedAt: SEED_ORGANIZATION.createdAt + 7 * DAY_MS,
    // Seeded so the Personal Info demo (US-CW-034) has populated fields out of the box.
    phone: '+1 (415) 555-0142',
    jobTitle: 'Finance Manager',
  },
  {
    id: 'user_2',
    email: 'employee@clearline.dev',
    passwordHash: DEMO_PASSWORD_HASH,
    verified: true,
    displayName: 'Theo Alvarez',
    role: 'employee',
    approvalLimit: null,
    isAdmin: false,
    isOwner: false,
    orgId: SEED_ORGANIZATION.id,
    joinedAt: SEED_ORGANIZATION.createdAt + 45 * DAY_MS,
  },
  {
    id: 'user_3',
    email: 'controller@clearline.dev',
    passwordHash: DEMO_PASSWORD_HASH,
    verified: true,
    displayName: 'Sofia Whitman',
    role: 'controller',
    approvalLimit: null,
    // Admin without being Owner — the delegable team-administration permission the epic models as
    // orthogonal to the approval tier (US-CW-006 AC-08). Reaches the Team surface, but can't be
    // the protected Owner. The demo account for "an Admin who isn't the Owner manages the team".
    isAdmin: true,
    isOwner: false,
    orgId: SEED_ORGANIZATION.id,
    joinedAt: SEED_ORGANIZATION.createdAt + 30 * DAY_MS,
  },
  {
    // The organization's Owner — a per-org singleton that can't be removed or demoted (US-CW-030
    // AC-03). The account a tester signs in as to exercise the Team surface (US-CW-031).
    id: 'user_owner',
    email: 'owner@clearline.dev',
    passwordHash: DEMO_PASSWORD_HASH,
    verified: true,
    displayName: 'Priya Nair',
    role: 'controller',
    approvalLimit: null,
    isAdmin: false,
    isOwner: true,
    orgId: SEED_ORGANIZATION.id,
    joinedAt: SEED_ORGANIZATION.createdAt,
  },
];
