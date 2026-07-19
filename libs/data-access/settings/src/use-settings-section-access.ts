import { useQuery } from '@tanstack/react-query';
import type { SettingsSectionSlug } from '@clearline/contracts';
import { settingsKeys } from './settings-query-keys';
import { fetchSettingsSectionAccess } from './fetch-settings';

/**
 * The server-side authorization probe for an Organization settings section (US-CW-033 AC-04). The
 * RequirePermission route guard already hides the section client-side; this independently confirms the
 * server allows it, so the section still degrades to access-denied on a 403 even if the guard were
 * bypassed or authority was removed mid-session. `retry: false` so a 403 surfaces immediately rather
 * than being retried. Profile sections don't need this — they're universal.
 */
export function useSettingsSectionAccess(slug: SettingsSectionSlug) {
  return useQuery({
    queryKey: settingsKeys.sectionAccess(slug),
    queryFn: () => fetchSettingsSectionAccess(slug),
    retry: false,
  });
}
