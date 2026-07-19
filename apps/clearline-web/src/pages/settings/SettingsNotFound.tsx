import { Link } from 'react-router';
import { Text } from '@clearline/ui';
import { DEFAULT_SETTINGS_SLUG, settingsPathForSlug } from '../../rbac/settings-sections';

/**
 * The in-shell not-found for an unknown /settings/{slug} (US-CW-033 edge case) — an unrecognized slug
 * lands here inside the settings surface rather than on a blank content region or the app-wide 404, so
 * SettingsNav stays visible and the user can recover. A deep-link to /settings/team resolves here too,
 * since Team & Members is a top-level page (US-CW-031), not a settings section.
 */
export function SettingsNotFound() {
  return (
    <section className="border-cl-border bg-cl-surface flex flex-col items-start gap-2 rounded-xl border p-6">
      <Text as="h2" size="heading">
        Section not found
      </Text>
      <Text as="p" tone="muted">
        This settings section doesn’t exist. Pick a section from the menu, or head to your personal
        settings.
      </Text>
      <Link
        to={settingsPathForSlug(DEFAULT_SETTINGS_SLUG)}
        className="text-cl-accent-text underline"
      >
        Go to Personal Info
      </Link>
    </section>
  );
}
