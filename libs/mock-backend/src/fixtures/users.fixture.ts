export interface SeedUser {
  id: string;
  email: string;
  /** PBKDF2-HMAC-SHA256 hash (see @fintech-portfolio/domain-auth password-hashing) — never plaintext, even in seed data. */
  passwordHash: string;
}

/** The plaintext DEMO_USER_PASSWORD was hashed from, kept only so local dev/tests can log in as the seed user. */
export const DEMO_USER_PASSWORD = 'Correct-Horse-Battery-1';

/** Deterministic seed users for local dev/demo and tests — never real credentials. */
export const SEED_USERS: SeedUser[] = [
  {
    id: 'user_1',
    email: 'demo@clearline.dev',
    passwordHash: 'pbkdf2-sha256$210000$EVdpGm+5ZSyaf/tp5qNqAA==$2HU7zHF8PxFivV/4XCZ8GGQeUpHl/B71IO6/yMl3ZhM=',
  },
];
