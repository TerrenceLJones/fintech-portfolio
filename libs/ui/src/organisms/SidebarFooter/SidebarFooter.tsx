import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../../atoms/Avatar';
import { Text } from '../../atoms/Text';
import { Icon } from '../../foundations/Icon';

export interface SidebarIdentity {
  /** The signed-in user's name — rendered bold, truncated to the rail width. */
  name: string;
  /** Avatar initials (e.g. "PN"), shown when there is no photo. */
  initials: string;
  /** Avatar photo URL; when set it replaces the initials — the single avatar source of truth updated from Personal Info (US-CW-034 AC-05). */
  avatarUrl?: string | null;
  /** Human-readable role (e.g. "Finance Manager"). */
  roleLabel: string;
  /** Secondary authority detail shown after the role (e.g. "$10k limit", "Unlimited", "Admin"); omit when there is none. */
  detail?: string | null;
}

export interface SidebarFooterProps {
  identity?: SidebarIdentity;
  /** While the session is still resolving, show a placeholder rather than a flash of the wrong identity. */
  loading?: boolean;
  /**
   * Raised when the user picks "Log out" from the identity menu (US-CW-048). When provided (together
   * with the identity), the footer becomes an interactive menu trigger; when omitted it stays a static
   * presentational block. The organism owns no auth/routing — it only signals intent.
   */
  onLogout?: () => void;
  /** Raised when the user picks "Manage account" — the app routes to Personal Info / Security (US-CW-032 update). */
  onManageAccount?: () => void;
  /** True while a sign-out request is in flight — disables "Log out" so it can't be double-submitted (US-CW-048 AC-02). */
  loggingOut?: boolean;
}

/**
 * The user-identity block pinned to the bottom of the sidebar rail (design §3.1 / US-CW-032):
 * avatar initials, name, and role · authority detail. Presentational — it reads the values it is
 * given and owns no authorization decision or routing.
 *
 * When `onLogout`/`onManageAccount` are supplied (US-CW-048 / the US-CW-032 update) the identity chip
 * becomes a keyboard-operable menu trigger carrying "Manage account" and "Log out"; the menu closes on
 * Escape, outside-click, or item-select and restores focus to the trigger. The organism still raises
 * only intent — AppChrome wires those to the use-logout hook and navigation, keeping this free of any
 * auth/routing/ThemeProvider dependency so it drops into any layout and renders standalone.
 */
export function SidebarFooter({
  identity,
  loading,
  onLogout,
  onManageAccount,
  loggingOut,
}: SidebarFooterProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasMenu = Boolean(identity) && (Boolean(onLogout) || Boolean(onManageAccount));

  // Close on Escape (restoring focus to the trigger) and on any click outside the footer — the same
  // dismissal discipline the app's other overlays use.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

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

  const identityBlock = (
    <>
      <Avatar
        initials={identity.initials}
        src={identity.avatarUrl ?? undefined}
        alt={identity.name}
        size={30}
      />
      <div className="flex min-w-0 flex-1 flex-col text-left">
        <Text as="div" size="label" weight="semibold" className="truncate" title={identity.name}>
          {identity.name}
        </Text>
        <Text as="div" size="label" className="text-cl-text-3 truncate text-[10.5px] leading-tight">
          {secondary}
        </Text>
      </div>
    </>
  );

  // Static, presentational block when the app supplies no menu handlers (Storybook, tests, any layout
  // that doesn't want a menu) — keeps the organism dependency-free by default.
  if (!hasMenu) {
    return (
      <div className="border-cl-border mt-auto flex items-center gap-2.5 border-t px-2 py-2.5">
        {identityBlock}
      </div>
    );
  }

  const select = (action?: () => void) => {
    setOpen(false);
    action?.();
  };

  return (
    <div ref={containerRef} className="border-cl-border relative mt-auto border-t pt-2.5">
      {open ? (
        // Anchored above the chip so it never overflows the bottom of the rail.
        <div
          role="menu"
          aria-label="Account menu"
          className="bg-cl-surface border-cl-border absolute bottom-full left-0 mb-1.5 w-full overflow-hidden rounded-lg border shadow-lg"
        >
          {onManageAccount ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => select(onManageAccount)}
              className="hover:bg-cl-surface-2 focus-visible:bg-cl-surface-2 flex w-full items-center gap-2 px-3 py-2 text-left outline-none"
            >
              <Icon name="settings" size={14} className="text-cl-text-3" />
              <Text as="span" size="label">
                Manage account
              </Text>
            </button>
          ) : null}
          {onLogout ? (
            <button
              type="button"
              role="menuitem"
              aria-label="Log out"
              disabled={loggingOut}
              onClick={() => select(onLogout)}
              className="hover:bg-cl-surface-2 focus-visible:bg-cl-surface-2 text-cl-neg flex w-full items-center gap-2 px-3 py-2 text-left outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon name="lock" size={14} />
              <Text as="span" size="label" className="text-cl-neg">
                {loggingOut ? 'Logging out…' : 'Log out'}
              </Text>
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="hover:bg-cl-surface-2 focus-visible:ring-cl-focus flex w-full items-center gap-2.5 rounded-lg px-2 py-1 outline-none focus-visible:ring-3"
      >
        {identityBlock}
        <Icon name="chevron-down" size={14} className="text-cl-text-3 shrink-0" />
      </button>
    </div>
  );
}
