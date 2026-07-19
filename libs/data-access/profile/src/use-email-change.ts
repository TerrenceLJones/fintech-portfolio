import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  ConfirmEmailChangeResponse,
  ProfileResponse,
  RequestEmailChangeErrorCode,
  RequestEmailChangeResponse,
  ValidateEmailChangeTokenResponse,
} from '@clearline/contracts';
import { profileKeys } from './profile-query-keys';

/** Typed rejection of an email-change request so the form can show the right inline message (AC-03). */
export class RequestEmailChangeError extends Error {
  readonly code: RequestEmailChangeErrorCode;
  constructor(code: RequestEmailChangeErrorCode) {
    super(code);
    this.code = code;
  }
}

/** Begin a verified email change (AC-03). Invalidates the profile so the pending indicator appears. */
export function useRequestEmailChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newEmail: string): Promise<RequestEmailChangeResponse> => {
      const response = await authenticatedFetch('/api/profile/email-change', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      });
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          const body = (await response.json()) as { error: RequestEmailChangeErrorCode };
          throw new RequestEmailChangeError(body.error);
        }
        throw new Error('email_change_request_failed');
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.profile }),
  });
}

/** Cancel an outstanding email change (AC-03 "Cancel change"), clearing the pending indicator. */
export function useCancelEmailChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<ProfileResponse> => {
      const response = await authenticatedFetch('/api/profile/email-change', { method: 'DELETE' });
      if (!response.ok) throw new Error('email_change_cancel_failed');
      return response.json();
    },
    onSuccess: (profile) => queryClient.setQueryData(profileKeys.profile, profile),
  });
}

// The confirm/validate pair is token-bearing, not session-bearing: the link is opened from an email
// and may reach a browser with no active session — so these use plain fetch, like password reset.

/** Whether an email-change confirmation link is still usable (AC-04). Disabled until a token is present. */
export function useValidateEmailChangeToken(token: string) {
  return useQuery({
    queryKey: profileKeys.emailChangeToken(token),
    queryFn: async (): Promise<ValidateEmailChangeTokenResponse> => {
      const response = await fetch(
        `/api/profile/email-change/validate?token=${encodeURIComponent(token)}`,
      );
      if (!response.ok) throw new Error('email_change_validate_failed');
      return response.json();
    },
    enabled: token.length > 0,
    retry: false,
  });
}

/** Apply a pending email change by presenting the link's token (AC-03/04). */
export function useConfirmEmailChange() {
  return useMutation({
    mutationFn: async (token: string): Promise<ConfirmEmailChangeResponse> => {
      const response = await fetch('/api/profile/email-change/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error('email_change_confirm_failed');
      return response.json();
    },
  });
}
