import { useNavigate } from 'react-router';
import type { SettingsSectionSlug } from '@clearline/contracts';
import { AccessDenied } from '@clearline/ui';
import { SettingsForbiddenError, useSettingsSectionAccess } from '@clearline/data-access-settings';
import { DEFAULT_SETTINGS_SLUG, settingsPathForSlug } from '../../rbac/settings-sections';
import { SettingsSectionPlaceholder } from './SettingsSectionPlaceholder';

export interface OrgSettingsSectionPlaceholderProps {
  slug: SettingsSectionSlug;
  title: string;
}

/**
 * An Organization settings section placeholder that additionally honors the server's independent
 * authorization decision (US-CW-033 AC-04, "client hides, server decides"). RequirePermission already
 * hides the route client-side; this probes GET /api/settings/sections/:slug so the section still
 * degrades to AccessDenied on a 403 even if the client guard were bypassed or authority was removed
 * mid-session — the server, not the UI, is the boundary. The title renders immediately (during the
 * probe and on success); only a typed 403 swaps to AccessDenied. Profile sections don't use this —
 * they're universal.
 */
export function OrgSettingsSectionPlaceholder({ slug, title }: OrgSettingsSectionPlaceholderProps) {
  const navigate = useNavigate();
  const { isError, error } = useSettingsSectionAccess(slug);

  if (isError && error instanceof SettingsForbiddenError) {
    return (
      <AccessDenied
        message="Ask an admin if you need it. This settings section is available to a different role."
        requestLine={`403 Forbidden · GET /api/settings/sections/${slug}`}
        actionLabel="Back to Personal Info"
        onAction={() => navigate(settingsPathForSlug(DEFAULT_SETTINGS_SLUG))}
      />
    );
  }

  return <SettingsSectionPlaceholder title={title} />;
}
