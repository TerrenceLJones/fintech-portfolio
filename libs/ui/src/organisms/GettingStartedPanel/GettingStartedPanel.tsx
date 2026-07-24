import { useEffect, useRef, type RefObject } from 'react';
import type { IconName } from '@clearline/icons';
import { Icon } from '../../foundations/Icon';
import { Text } from '../../atoms/Text';
import { Button } from '../../atoms/Button';
import { ProgressBar } from '../../atoms/ProgressBar';

export type GettingStartedTaskStatus = 'done' | 'current' | 'upcoming';

export interface GettingStartedTaskView {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  /** The verb on the row's action button (Submit / Issue / Invite / Set / Open / View). */
  cta: string;
  status: GettingStartedTaskStatus;
  /** The persona's signature (milestone) task — the first task. Drives the "Start here" badge. */
  isSignature: boolean;
}

export interface GettingStartedPanelProps {
  /** Header title — "Set up your workspace" for the Owner first-run, "Get started" otherwise. */
  title: string;
  /** Optional one-line subtitle under the title (Owner variant only in the design). */
  subtitle?: string;
  completedCount: number;
  totalCount: number;
  tasks: GettingStartedTaskView[];
  /** Deep-link to a task's destination (US-CW-044 AC-03). Never marks it complete (US-CW-047 AC-02). */
  onSelectTask: (id: string) => void;
  /** Dismiss the panel — close control, Escape, or click-away (AC-04). */
  onClose: () => void;
  /**
   * Optional boundary the click-away check treats as "inside". Pass the element that also holds the
   * trigger (e.g. the rail entry) so a click on the trigger doesn't close-then-reopen the panel;
   * defaults to the panel itself.
   */
  boundaryRef?: RefObject<HTMLElement | null>;
}

/** The badge on the current (next-to-do) row: "Start here" for the signature, "Next" thereafter. */
function currentBadge(task: GettingStartedTaskView): string {
  return task.isSignature ? 'Start here' : 'Next';
}

function TaskRow({
  task,
  onSelect,
}: {
  task: GettingStartedTaskView;
  onSelect: (id: string) => void;
}) {
  const isDone = task.status === 'done';
  const isCurrent = task.status === 'current';

  const iconWrap = isDone
    ? 'bg-cl-pos-weak text-cl-pos'
    : isCurrent
      ? 'bg-cl-accent-weak text-cl-accent-text ring-cl-accent ring-1 ring-inset'
      : 'bg-cl-surface-2 text-cl-text-3';

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl px-3 py-2.75',
        isCurrent ? 'bg-cl-surface-2' : '',
      ].join(' ')}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconWrap}`}>
        <Icon name={isDone ? 'check' : task.icon} size={16} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.75">
          <Text
            as="span"
            size="label"
            weight="semibold"
            className={isDone ? 'text-cl-text-2 line-through' : 'text-cl-text'}
          >
            {task.title}
          </Text>
          {isCurrent ? (
            <span className="bg-cl-accent-weak text-cl-accent-text rounded px-1.5 py-px text-[9.5px] font-bold tracking-wide uppercase">
              {currentBadge(task)}
            </span>
          ) : null}
        </span>
        {isDone ? (
          <span className="text-cl-pos mt-0.5 flex items-center gap-1.25 text-[11px] font-semibold">
            <Icon name="check" size={12} />
            Done
          </span>
        ) : (
          <Text as="span" size="label" weight="regular" tone="muted" className="mt-0.5 block">
            {task.description}
          </Text>
        )}
      </span>

      <Button
        variant={isCurrent ? 'primary' : isDone ? 'ghost' : 'secondary'}
        size="sm"
        onClick={() => onSelect(task.id)}
      >
        {isDone ? 'View' : task.cta}
      </Button>
    </div>
  );
}

/**
 * The launchpad panel (US-CW-044 AC-02): the role-scoped checklist that opens off the rail entry. It
 * lists exactly the tasks the role can perform, each with a title, one-line description, a state
 * (done / current / upcoming) and a deep-link action. A ProgressBar with an explicit "X of N complete"
 * label sits at the top. There is deliberately no control anywhere to mark a task done or skip it —
 * completion is observed, never self-reported (US-CW-047 AC-02).
 *
 * Non-modal (like the rest of the shell's overlays): it dismisses on its close control, Escape, or a
 * click outside, and never blocks the page beneath it (AC-04). It does not trap focus.
 */
export function GettingStartedPanel({
  title,
  subtitle,
  completedCount,
  totalCount,
  tasks,
  onSelectTask,
  onClose,
  boundaryRef,
}: GettingStartedPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const countLabel = `${completedCount} of ${totalCount} complete`;

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointerDown = (event: MouseEvent) => {
      // Treat a click on the trigger (rail entry) as inside, so it can toggle the panel closed
      // instead of this click-away closing it a beat before the trigger's onClick reopens it.
      const boundary = boundaryRef?.current ?? panelRef.current;
      if (boundary && !boundary.contains(event.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      className="border-cl-border bg-cl-surface w-93 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border shadow-2xl"
    >
      <div className="border-cl-border border-b px-4.5 pt-4 pb-3.75">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon name="sparkles" size={16} className="text-cl-accent-text" />
              <Text as="span" size="heading">
                {title}
              </Text>
            </div>
            {subtitle ? (
              <Text as="p" size="label" tone="muted" className="mt-1 mb-0">
                {subtitle}
              </Text>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close getting started"
            className="border-cl-border-2 text-cl-text-3 focus-visible:ring-cl-focus flex h-6.5 w-6.5 shrink-0 cursor-pointer items-center justify-center rounded-md border outline-none focus-visible:ring-3"
          >
            <Icon name="x" size={13} />
          </button>
        </div>

        <div className="mt-3.5">
          <div className="mb-1.75 flex items-center justify-between">
            <Text as="span" size="label" tone="muted">
              Progress
            </Text>
            <Text as="span" size="mono" className="text-cl-text-3">
              {countLabel}
            </Text>
          </div>
          <ProgressBar
            value={completedCount}
            max={totalCount}
            tone={completedCount >= totalCount ? 'positive' : 'accent'}
            height={6}
            label={`Getting started progress: ${countLabel}`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-0.5 p-2">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onSelect={onSelectTask} />
        ))}
      </div>
    </div>
  );
}
