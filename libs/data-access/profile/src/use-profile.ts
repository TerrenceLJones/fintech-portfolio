import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type { ProfileResponse, UpdateProfileRequest } from '@clearline/contracts';
import { SESSION_QUERY_KEY, profileKeys } from './profile-query-keys';

async function getProfile(): Promise<ProfileResponse> {
  const response = await authenticatedFetch('/api/profile');
  if (!response.ok) throw new Error('profile_fetch_failed');
  return response.json();
}

/** The signed-in user's editable identity + any pending email change (US-CW-034 AC-01/03/05). */
export function useProfile() {
  return useQuery({ queryKey: profileKeys.profile, queryFn: getProfile });
}

async function patchProfile(request: UpdateProfileRequest): Promise<ProfileResponse> {
  const response = await authenticatedFetch('/api/profile', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('profile_update_failed');
  return response.json();
}

/** Persist a name/phone/job-title edit (AC-01), priming the profile cache and refreshing the sidebar name. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.profile, profile);
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}
