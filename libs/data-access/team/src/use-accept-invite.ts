import { useMutation } from '@tanstack/react-query';
import type { AcceptInviteResponse } from '@clearline/contracts';
import { setAccessToken } from '@clearline/data-access-auth';

/**
 * Public — accept an invite by setting a password (US-CW-031 AC-02). On a 'success' outcome the
 * returned access token is stored (auto-login, exactly like email verification) so the invitee lands
 * on their role dashboard; the non-success outcomes ('invite_expired' / 'invite_invalid' /
 * 'weak_password') come back as data for the page to render, not thrown errors.
 */
async function postAcceptInvite(input: {
  token: string;
  password: string;
}): Promise<AcceptInviteResponse> {
  let response: Response;
  try {
    response = await fetch(`/api/team/invites/${encodeURIComponent(input.token)}/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: input.password }),
    });
  } catch {
    throw new Error('network_error');
  }
  if (!response.ok) {
    throw new Error('invite_accept_failed');
  }
  const body = (await response.json()) as AcceptInviteResponse;
  if (body.outcome === 'success' && body.accessToken) {
    setAccessToken(body.accessToken);
  }
  return body;
}

export function useAcceptInvite() {
  return useMutation({ mutationFn: postAcceptInvite });
}
