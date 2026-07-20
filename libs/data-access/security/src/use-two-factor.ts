import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  DisableTwoFactorErrorCode,
  DisableTwoFactorResponse,
  StartTotpSetupResponse,
  TwoFactorStatus,
  VerifyTotpSetupErrorCode,
  VerifyTotpSetupResponse,
} from '@clearline/contracts';
import { securityKeys } from './security-query-keys';

/** Whether 2FA is on, and whether the org mandates it (AC-07). */
export function useTwoFactorStatus() {
  return useQuery({
    queryKey: securityKeys.twoFactor,
    queryFn: async (): Promise<TwoFactorStatus> => {
      const response = await authenticatedFetch('/api/security/two-factor');
      if (!response.ok) throw new Error('two_factor_status_failed');
      return response.json();
    },
  });
}

/**
 * Begin TOTP setup (AC-03): returns the secret + otpauth URI once so the client can render the QR
 * locally. Not a query — each call mints a fresh secret, so it is an explicit action.
 */
export function useStartTotpSetup() {
  return useMutation({
    mutationFn: async (): Promise<StartTotpSetupResponse> => {
      const response = await authenticatedFetch('/api/security/two-factor/setup', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('two_factor_setup_failed');
      return response.json();
    },
  });
}

/** Typed rejection of a verify step so the flow stays on step 2 with the right message (AC-05). */
export class VerifyTotpSetupError extends Error {
  readonly code: VerifyTotpSetupErrorCode;
  constructor(code: VerifyTotpSetupErrorCode) {
    super(code);
    this.code = code;
  }
}

/** Complete setup by verifying a code (AC-04/05). On success, refreshes the 2FA status + trusted devices. */
export function useVerifyTotpSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<VerifyTotpSetupResponse> => {
      const response = await authenticatedFetch('/api/security/two-factor/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          const body = (await response.json()) as { error: VerifyTotpSetupErrorCode };
          throw new VerifyTotpSetupError(body.error);
        }
        throw new Error('two_factor_verify_failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityKeys.twoFactor });
      queryClient.invalidateQueries({ queryKey: securityKeys.trustedDevices });
    },
  });
}

/** Typed rejection of a disable attempt — `org_enforced` when the org mandates 2FA (AC-07). */
export class DisableTwoFactorError extends Error {
  readonly code: DisableTwoFactorErrorCode;
  constructor(code: DisableTwoFactorErrorCode) {
    super(code);
    this.code = code;
  }
}

/** Disable 2FA (AC-07). Refreshes the 2FA status + trusted devices (disabling voids them). */
export function useDisableTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<DisableTwoFactorResponse> => {
      const response = await authenticatedFetch('/api/security/two-factor/disable', {
        method: 'POST',
      });
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          const body = (await response.json()) as { error: DisableTwoFactorErrorCode };
          throw new DisableTwoFactorError(body.error);
        }
        throw new Error('two_factor_disable_failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityKeys.twoFactor });
      queryClient.invalidateQueries({ queryKey: securityKeys.trustedDevices });
    },
  });
}
