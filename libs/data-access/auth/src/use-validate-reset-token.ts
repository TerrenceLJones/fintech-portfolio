import { useQuery } from '@tanstack/react-query';
import type { ValidateResetTokenResponse } from '@fintech-portfolio/contracts';

async function getValidateResetToken(token: string): Promise<ValidateResetTokenResponse> {
  const response = await fetch(
    `/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
  );
  if (!response.ok) {
    throw new Error('network_error');
  }
  return response.json();
}

/** Disabled until a token is present — the reset-password page has nothing to validate before then. */
export function useValidateResetToken(token: string | null) {
  return useQuery({
    queryKey: ['reset-password', 'validate', token],
    queryFn: () => getValidateResetToken(token!),
    enabled: token != null && token.length > 0,
  });
}
