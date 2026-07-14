import { useMemo } from 'react';
import type { IconName } from '@clearline/icons';
import { EmptyState } from '@clearline/ui';
import { useDemoBeacon, type DemoBeaconPageConfig } from '@clearline/demo-beacon';

export interface PlaceholderPageProps {
  title: string;
  icon: IconName;
  body: string;
}

/**
 * A minimal stand-in for a role-gated section this epic exposes in the nav but doesn't own (My Cards,
 * Reconciliation, Budget Management, Audit Log, Team). It exists so the role-scoped nav links resolve
 * and the RequirePermission guard is demonstrable for every gated route; the real content lands in
 * the epic that owns each section. The shell heading and browser tab come from the active nav label
 * via AppChrome (US-CW-006); this only supplies the empty-state copy for the section body.
 */
export function PlaceholderPage({ title, icon, body }: PlaceholderPageProps) {
  // One registration serves every placeholder route — the config is derived from the page's own
  // props, so the Beacon explains that this section is an intentional stub for the demo.
  useDemoBeacon(
    useMemo<DemoBeaconPageConfig>(
      () => ({
        pageId: `placeholder:${title}`,
        title,
        summary:
          'This section is a placeholder in the demo — the nav link and access guard are real, the content isn’t built yet.',
        sections: [{ kind: 'text', title: 'About this page', body }],
      }),
      [title, body],
    ),
  );

  return <EmptyState icon={icon} title={title} body={body} />;
}
