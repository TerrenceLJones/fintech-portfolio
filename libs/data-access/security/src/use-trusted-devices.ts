import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type { RemoveTrustedDeviceResponse, TrustedDeviceListResponse } from '@clearline/contracts';
import { securityKeys } from './security-query-keys';

/** The caller's trusted-device exemptions (AC-10). */
export function useTrustedDevices() {
  return useQuery({
    queryKey: securityKeys.trustedDevices,
    queryFn: async (): Promise<TrustedDeviceListResponse> => {
      const response = await authenticatedFetch('/api/security/trusted-devices');
      if (!response.ok) throw new Error('trusted_devices_fetch_failed');
      return response.json();
    },
  });
}

/** Remove a trusted device (AC-10) so its next login re-prompts for 2FA. Refreshes the list. */
export function useRemoveTrustedDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deviceId: string): Promise<RemoveTrustedDeviceResponse> => {
      const response = await authenticatedFetch(
        `/api/security/trusted-devices/${encodeURIComponent(deviceId)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error('trusted_device_remove_failed');
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: securityKeys.trustedDevices }),
  });
}
