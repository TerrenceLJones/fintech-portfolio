import { Text } from '@clearline/ui';

export interface SettingsSectionPlaceholderProps {
  /** The section's human title, e.g. "Personal Info". */
  title: string;
  /** Optional supporting line; defaults to a neutral "coming soon" note. */
  description?: string;
}

/**
 * A neutral placeholder for a settings section whose full UI is delivered by a later US-CW-022 story
 * (US-CW-034…042). The shell, routing and role-gating are US-CW-033's scope; this stands in for the
 * section body so the reachable, role-scoped surface can be built and tested now. The section heading
 * is an <h2> beneath the AppShell's "Settings" <h1>.
 */
export function SettingsSectionPlaceholder({
  title,
  description,
}: SettingsSectionPlaceholderProps) {
  return (
    <section className="border-cl-border bg-cl-surface flex flex-col gap-2 rounded-xl border p-6">
      <Text as="h2" size="heading">
        {title}
      </Text>
      <Text as="p" tone="muted">
        {description ?? 'This settings section is coming soon.'}
      </Text>
    </section>
  );
}
