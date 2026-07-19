import { type MouseEvent, useId } from 'react';
import { Text } from '../../atoms/Text';

/** A single settings section — a deep-linkable destination inside the /settings surface. */
export interface SettingsNavItem {
  id: string;
  label: string;
  /** Deep-linkable path; the item renders as a real link so it can be opened in a new tab. */
  href: string;
}

/** One of the two SettingsNav tiers (design §19.1): "Profile" (universal) and "Organization" (gated). */
export interface SettingsNavGroup {
  id: string;
  label: string;
  items: SettingsNavItem[];
}

export interface SettingsNavProps {
  /** Groups to render, already filtered to the sections the viewer may reach (client hides). */
  groups: SettingsNavGroup[];
  /** The id of the section currently being viewed. */
  activeId?: string;
  /** Called with a section id for in-app navigation; a plain click is intercepted so there's no reload. */
  onNavigate?: (id: string) => void;
  /** Accessible label for the whole secondary nav. @default 'Settings' */
  ariaLabel?: string;
}

/** A plain left-click with no modifier keys — the case we hijack for SPA navigation; anything else
 *  (middle-click, ⌘/Ctrl/Shift-click) is left to the browser so "open in new tab" still works. */
function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * The role-scoped, two-tier secondary navigation for the /settings surface (design §19.1, US-CW-033).
 * Presentational and router-agnostic, like NavigationShell: the caller supplies the already-filtered
 * groups (so an unauthorized Organization group is simply absent, never disabled) and handles routing
 * via `onNavigate`. Items are real links for deep-linkability and new-tab opening, but a plain click is
 * intercepted for reload-free SPA navigation. On narrow viewports the two tiers collapse to one labeled
 * <select> (AC-07) so the current section stays reachable and named when the rail can't sit beside the
 * content. The active item carries `aria-current="page"` and the design's accent treatment (AC-05/AC-08).
 */
export function SettingsNav({
  groups,
  activeId,
  onNavigate,
  ariaLabel = 'Settings',
}: SettingsNavProps) {
  const headingBaseId = useId();
  const selectId = useId();

  return (
    <div className="w-full md:w-56 md:shrink-0">
      {/* Wide viewport: the two-tier rail. */}
      <nav aria-label={ariaLabel} className="hidden flex-col gap-6 md:flex">
        {groups.map((group) => {
          const headingId = `${headingBaseId}-${group.id}`;
          return (
            <div key={group.id} role="group" aria-labelledby={headingId}>
              <Text
                as="p"
                id={headingId}
                size="label"
                weight="semibold"
                tone="faint"
                className="mb-1.5 px-2.75 text-[0.6875rem] uppercase tracking-wider"
              >
                {group.label}
              </Text>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = item.id === activeId;
                  return (
                    <li key={item.id}>
                      <a
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        onClick={(event) => {
                          if (isPlainLeftClick(event)) {
                            event.preventDefault();
                            onNavigate?.(item.id);
                          }
                        }}
                        className={[
                          'focus-visible:ring-cl-focus flex w-full items-center rounded-lg px-2.75 py-1.75 outline-none focus-visible:ring-3',
                          active ? 'bg-cl-accent-weak' : '',
                        ].join(' ')}
                      >
                        <Text
                          as="span"
                          size="label"
                          weight={active ? 'semibold' : 'medium'}
                          className={[
                            'whitespace-nowrap',
                            active ? 'text-cl-accent-text' : 'text-cl-text-2',
                          ].join(' ')}
                        >
                          {item.label}
                        </Text>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Narrow viewport: the same sections collapsed to one labeled menu (AC-07). */}
      <div className="md:hidden">
        <Text as="label" htmlFor={selectId} size="label" weight="medium" className="sr-only">
          Settings section
        </Text>
        <select
          id={selectId}
          // Fall back to '' (matches no option) when there's no active section — e.g. the in-shell
          // not-found — so the control stays controlled rather than flipping to uncontrolled.
          value={activeId ?? ''}
          onChange={(event) => onNavigate?.(event.target.value)}
          className="border-cl-border bg-cl-surface text-cl-text-1 focus-visible:ring-cl-focus w-full rounded-lg border px-3 py-2 outline-none focus-visible:ring-3"
        >
          {groups.map((group) => (
            <optgroup key={group.id} label={group.label}>
              {group.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}
