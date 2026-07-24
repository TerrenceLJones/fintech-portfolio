import { Icon } from '../../foundations/Icon';
import { Text } from '../../atoms/Text';
import { ProgressBar } from '../../atoms/ProgressBar';

export interface GettingStartedRailEntryProps {
  /** Tasks completed so far (the "X" in "X of N"). */
  completedCount: number;
  /** Total tasks for the role (the "N"). */
  totalCount: number;
  /** True while the launchpad panel is open — gives the entry its active/expanded styling. */
  open?: boolean;
  /** Opens (or toggles) the launchpad panel. */
  onClick: () => void;
}

/**
 * The getting-started launcher's home in the sidebar rail (US-CW-044 AC-01): a pinned row at the foot
 * of the nav list, directly above the identity footer, carrying a slim ProgressBar and an "X of N"
 * count. Visually distinct from the permanent nav destinations (a surface-2 card with its own
 * separator) so it can retire on completion without the nav reflowing. It is a NavItem-shaped button
 * but deliberately not a NavItem: it is transient onboarding state, not a permanent destination.
 *
 * Progress is a real ProgressBar (role="progressbar") and the "X of N" figure is always rendered as
 * text beside it, so progress is never conveyed by fill alone (accessibility; Design §17).
 */
export function GettingStartedRailEntry({
  completedCount,
  totalCount,
  open = false,
  onClick,
}: GettingStartedRailEntryProps) {
  const countLabel = `${completedCount} of ${totalCount}`;
  return (
    <div className="border-cl-border mt-3.5 border-t pt-3">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={open}
        aria-label={`Getting started — ${countLabel} tasks complete`}
        className={[
          'bg-cl-surface-2 focus-visible:ring-cl-focus flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.75 py-2.25 text-left outline-none focus-visible:ring-3',
          open ? 'ring-cl-accent ring-1' : '',
        ].join(' ')}
      >
        <Icon name="sparkles" size={16} className="text-cl-accent-text shrink-0" />
        <span className="min-w-0 flex-1">
          <Text as="span" size="label" weight="semibold" className="text-cl-text block truncate">
            Getting started
          </Text>
          <span className="mt-1.75 flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <ProgressBar
                value={completedCount}
                max={totalCount}
                height={5}
                label={`Getting started progress: ${countLabel} complete`}
              />
            </span>
            <Text as="span" size="mono" className="text-cl-text-3 shrink-0 whitespace-nowrap">
              {countLabel}
            </Text>
          </span>
        </span>
      </button>
    </div>
  );
}
