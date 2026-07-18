import { useQuery } from '@tanstack/react-query';
import { teamKeys } from './team-query-keys';
import { fetchTeamRoster } from './fetch-team';

/** The organization's members and pending invites, for the Team page (US-CW-031 / Design §18.1). */
export function useTeamRoster() {
  return useQuery({
    queryKey: teamKeys.roster(),
    queryFn: fetchTeamRoster,
    retry: false,
  });
}
