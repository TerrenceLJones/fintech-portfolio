import { authenticatedFetch } from '@clearline/data-access-auth';
import type { SettingsSectionAccessResponse, SettingsSectionSlug } from '@clearline/contracts';
import { SettingsForbiddenError } from './settings-forbidden-error';

/**
 * Ask the server whether the current user may reach a settings section (US-CW-033 AC-04). A 403 becomes
 * SettingsForbiddenError so the section can render access-denied; any other non-2xx throws.
 */
export async function fetchSettingsSectionAccess(
  slug: SettingsSectionSlug,
): Promise<SettingsSectionAccessResponse> {
  const response = await authenticatedFetch(`/api/settings/sections/${encodeURIComponent(slug)}`);
  if (response.status === 403) {
    throw new SettingsForbiddenError();
  }
  if (!response.ok) {
    throw new Error('settings_section_access_failed');
  }
  return response.json() as Promise<SettingsSectionAccessResponse>;
}
