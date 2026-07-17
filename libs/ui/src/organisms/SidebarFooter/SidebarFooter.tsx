import { Avatar } from '../../atoms/Avatar';
import { Text } from '../../atoms/Text';

export interface SidebarIdentity {
  /** The signed-in user's name — rendered bold, truncated to the rail width. */
  name: string;
  /** Avatar initials (e.g. "PN"). */
  initials: string;
  /** Human-readable role (e.g. "Finance Manager"). */
  roleLabel: string;
  /** Secondary authority detail shown after the role (e.g. "$10k limit", "Unlimited", "Admin"); omit when there is none. */
  detail?: string | null;
}

export interface SidebarFooterProps {
  identity?: SidebarIdentity;
  /** While the session is still resolving, show a placeholder rather than a flash of the wrong identity. */
  loading?: boolean;
}

/**
 * The user-identity block pinned to the bottom of the sidebar rail (design §3.1 / US-CW-032):
 * avatar initials, name, and role · authority detail. Purely presentational — it reads the values
 * it is given, owns no authorization decision, and has no auth/routing/ThemeProvider dependency, so
 * it drops into any layout and renders standalone in Storybook/tests.
 */
export function SidebarFooter({ identity, loading }: SidebarFooterProps) {
  if (loading || !identity) {
    return (
      <div
        data-testid="sidebar-footer-loading"
        aria-hidden="true"
        className="border-cl-border mt-auto flex items-center gap-2.5 border-t px-2 py-2.5"
      >
        <span className="bg-cl-surface-2 h-[30px] w-[30px] flex-shrink-0 animate-pulse rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="bg-cl-surface-2 h-2.5 w-24 animate-pulse rounded" />
          <span className="bg-cl-surface-2 h-2 w-16 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  const secondary = identity.detail
    ? `${identity.roleLabel} · ${identity.detail}`
    : identity.roleLabel;

  return (
    <div className="border-cl-border mt-auto flex items-center gap-2.5 border-t px-2 py-2.5">
      <Avatar initials={identity.initials} size={30} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Text as="div" size="label" weight="semibold" className="truncate" title={identity.name}>
          {identity.name}
        </Text>
        <Text as="div" size="label" className="text-cl-text-3 truncate text-[10.5px] leading-tight">
          {secondary}
        </Text>
      </div>
    </div>
  );
}
