import { afterAll, afterEach, beforeAll } from 'vitest';
import type { HttpHandler } from 'msw';
import { setupServer } from 'msw/node';
import { hashPassword } from '@clearline/domain-auth';
import type {
  AuthErrorResponse,
  BeneficialOwner,
  BeneficialOwnerInput,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  RefreshResponse,
  ResetPasswordErrorResponse,
  ResetPasswordRequest,
  SessionErrorResponse,
  SessionResponse,
  SignUpErrorResponse,
  SignUpRequest,
  ValidateResetTokenResponse,
  ValidateVerifyEmailTokenResponse,
  VerifyEmailErrorResponse,
  VerifyEmailResponse,
} from '@clearline/contracts';
import { AuthService } from '../services/auth.service';
import type { SeedUser } from './users.fixture';

/** Plaintext a `buildSeedUser()` password hash is derived from, unless a test passes its own. */
export const DEFAULT_TEST_PASSWORD = 'correct-password';

/**
 * Builds a `SeedUser` with a real PBKDF2 hash, replacing the ad hoc `{ id, email, passwordHash:
 * await hashPassword(...), verified }` object literal duplicated across the AuthService test
 * files. Pass `password` to hash a specific plaintext, or `passwordHash` to reuse an
 * already-hashed value (e.g. sharing one hash across a verified/unverified pair).
 */
export async function buildSeedUser(
  overrides: Partial<Omit<SeedUser, 'passwordHash'>> & {
    password?: string;
    passwordHash?: string;
  } = {},
): Promise<SeedUser> {
  const {
    password,
    passwordHash,
    id = 'user_1',
    email = 'demo@clearline.dev',
    verified = true,
    displayName = 'Demo User',
    role = 'employee',
    approvalLimit = null,
    isAdmin = false,
    isOwner = false,
  } = overrides;

  return {
    id,
    email,
    verified,
    displayName,
    role,
    approvalLimit,
    isAdmin,
    isOwner,
    passwordHash: passwordHash ?? (await hashPassword(password ?? DEFAULT_TEST_PASSWORD)),
  };
}

export function buildLoginRequest(overrides: Partial<LoginRequest> = {}): LoginRequest {
  return { email: 'demo@clearline.dev', password: DEFAULT_TEST_PASSWORD, ...overrides };
}

export function buildLoginSuccessResponse(overrides: Partial<LoginResponse> = {}): LoginResponse {
  return { accessToken: 'access_123', hasOtherActiveSession: false, ...overrides };
}

export function buildVerifyEmailSuccessResponse(
  overrides: Partial<VerifyEmailResponse> = {},
): VerifyEmailResponse {
  return { accessToken: 'access_123', ...overrides };
}

/** Covers every AuthErrorResponse shape — pass `{ error: 'account_locked', supportReferenceId }` etc. */
export function buildAuthErrorResponse(
  overrides: Partial<AuthErrorResponse> = {},
): AuthErrorResponse {
  return { error: 'invalid_credentials', ...overrides };
}

export function buildSignUpRequest(overrides: Partial<SignUpRequest> = {}): SignUpRequest {
  return { email: 'new-owner@clearline.dev', password: 'Brand-New-Password-1!', ...overrides };
}

export function buildResetPasswordRequest(
  overrides: Partial<ResetPasswordRequest> = {},
): ResetPasswordRequest {
  return { token: 'reset-token-123', password: 'New-Horse-Battery-2', ...overrides };
}

export function buildValidateResetTokenResponse(
  overrides: Partial<ValidateResetTokenResponse> = {},
): ValidateResetTokenResponse {
  return { valid: true, ...overrides };
}

export function buildSignUpErrorResponse(
  overrides: Partial<SignUpErrorResponse> = {},
): SignUpErrorResponse {
  return { error: 'weak_password', ...overrides };
}

export function buildVerifyEmailErrorResponse(
  overrides: Partial<VerifyEmailErrorResponse> = {},
): VerifyEmailErrorResponse {
  return { error: 'token_invalid', ...overrides };
}

export function buildValidateVerifyEmailTokenResponse(
  overrides: Partial<ValidateVerifyEmailTokenResponse> = {},
): ValidateVerifyEmailTokenResponse {
  return { valid: true, ...overrides };
}

export function buildResetPasswordErrorResponse(
  overrides: Partial<ResetPasswordErrorResponse> = {},
): ResetPasswordErrorResponse {
  return { error: 'token_invalid', ...overrides };
}

export function buildRefreshResponse(overrides: Partial<RefreshResponse> = {}): RefreshResponse {
  return { accessToken: 'access_123', ...overrides };
}

export function buildLogoutResponse(): LogoutResponse {
  return {};
}

export function buildSessionResponse(overrides: Partial<SessionResponse> = {}): SessionResponse {
  return {
    userId: 'user_1',
    email: 'demo@clearline.dev',
    displayName: 'Demo User',
    role: 'finance_manager',
    approvalLimit: 1_000_000,
    currency: 'USD',
    isAdmin: false,
    isOwner: false,
    ...overrides,
  };
}

export function buildSessionErrorResponse(
  overrides: Partial<SessionErrorResponse> = {},
): SessionErrorResponse {
  return { error: 'invalid_token', ...overrides };
}

/** Builds a `BeneficialOwnerInput` (the add-owner request body), replacing the
 * `{ firstName, lastName, ownershipPercent }` literal repeated across the onboarding tests. */
export function buildBeneficialOwnerInput(
  overrides: Partial<BeneficialOwnerInput> = {},
): BeneficialOwnerInput {
  return { firstName: 'Dara', lastName: 'Reyes', ownershipPercent: 60, ...overrides };
}

/**
 * Builds a `BeneficialOwner` (the masked server record), replacing the owner-object literal
 * duplicated across the onboarding page/hook tests. `fullName` defaults to the server-derived
 * `${firstName} ${lastName}`, so overriding either name part keeps the combined value in sync;
 * pass `fullName` explicitly to override it.
 */
export function buildBeneficialOwner(overrides: Partial<BeneficialOwner> = {}): BeneficialOwner {
  const { firstName = 'Dara', lastName = 'Reyes', ...rest } = overrides;
  return {
    id: 'owner_1',
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    ownershipPercent: 60,
    requiresKyc: true,
    ...rest,
  };
}

/**
 * Replaces the `const server = setupServer(); beforeAll(...); afterEach(...); afterAll(...);`
 * boilerplate redefined identically across the page/hook test files that hit a real (non-fixed)
 * MSW server via `server.use(...)` per test. Must be called at test-file top level (registers
 * file-scoped hooks), same as the inline version it replaces.
 */
export function registerMswServer(): ReturnType<typeof setupServer> {
  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
}

/**
 * Replaces the `startServerWithFreshService()` helper redefined identically in every
 * `*.handlers.test.ts` file: builds an `AuthService` (optionally with specific seed users),
 * wires it into the given handler factory, and starts a listening MSW server bound to it.
 */
export function startMswServer(
  createHandlers: (authService: AuthService) => HttpHandler[],
  seedUsers?: SeedUser[],
): { server: ReturnType<typeof setupServer>; authService: AuthService } {
  const authService = new AuthService(seedUsers);
  const server = setupServer(...createHandlers(authService));
  server.listen({ onUnhandledRequest: 'error' });
  return { server, authService };
}
