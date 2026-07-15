import type { Role } from '@clearline/contracts';

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
   * both the approval tier and isAdmin; grants no permissions on its own in this epic. A protected
   * singleton per account — non-removable/non-demotable enforcement arrives with team management (EPIC-CW-018).
   */
  isOwner: boolean;
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
 * Deterministic seed users for local dev/demo and tests — never real credentials. One account per
 * approval-tier role so a tester can sign in as each and see its role-scoped shell and role-based
 * home (US-CW-006 / US-CW-001): the Employee lands on My Expenses, the approvers on the queue. The
 * Finance Manager (index 0, `demo@clearline.dev`) is the primary demo account e2e signs in as; its
 * role can still be switched mid-session via simulateRoleChangeForE2E. All share DEMO_USER_PASSWORD.
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
  },
  {
    id: 'user_3',
    email: 'controller@clearline.dev',
    passwordHash: DEMO_PASSWORD_HASH,
    verified: true,
    displayName: 'Sofia Whitman',
    role: 'controller',
    approvalLimit: null,
    isAdmin: false,
    isOwner: false,
  },
];
