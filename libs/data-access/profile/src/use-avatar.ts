import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type { ProfileResponse, UpdateAvatarRequest } from '@clearline/contracts';
import { SESSION_QUERY_KEY, profileKeys } from './profile-query-keys';

/**
 * Shared success handler for both avatar mutations: prime the profile cache and invalidate the
 * session so the sidebar identity chip re-reads the avatar — the single avatar source of truth
 * (US-CW-034 AC-05/06).
 */
function useAvatarMutation(mutationFn: (variables: string) => Promise<ProfileResponse>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.profile, profile);
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}

/** Upload a cropped avatar data URL (AC-05). */
export function useUpdateAvatar() {
  return useAvatarMutation(async (avatarUrl: string) => {
    const body: UpdateAvatarRequest = { avatarUrl };
    const response = await authenticatedFetch('/api/profile/avatar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('avatar_update_failed');
    return response.json();
  });
}

/** Remove the avatar, falling back to initials (AC-06). The variable is ignored (kept for a uniform signature). */
export function useRemoveAvatar() {
  return useAvatarMutation(async () => {
    const response = await authenticatedFetch('/api/profile/avatar', { method: 'DELETE' });
    if (!response.ok) throw new Error('avatar_remove_failed');
    return response.json();
  });
}
