import { useState, type RefObject } from 'react';
import { useLocation } from 'react-router';
import { SpotlightCoachmark } from '@clearline/ui';
import type { IconName } from '@clearline/icons';
import type { OnboardingTaskId } from '@clearline/contracts';
import { useGettingStartedTasks } from '@clearline/data-access-onboarding';
import { onboardingTaskById } from '../rbac/onboarding-tasks';

const DISMISSED_KEY = 'clearline:gs-spotlight-dismissed';

function readDismissed(): OnboardingTaskId[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]') as OnboardingTaskId[];
  } catch {
    return [];
  }
}

function persistDismissed(ids: OnboardingTaskId[]): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
}

export interface GettingStartedSpotlightProps {
  /** The task this page is the destination of. */
  taskId: OnboardingTaskId;
  /** The primary control the coachmark should point at. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Override the coachmark title (defaults to "Start here"). */
  title?: string;
  /** Override the coachmark body (defaults to the task's description). */
  body?: string;
  icon?: IconName;
}

/**
 * The page-side of the on-page spotlight (US-CW-046). A destination page registers its primary control
 * via `anchorRef` and drops this in; it renders the coachmark only when the user actually followed the
 * task from the launchpad (navigation intent, AC-05), the task isn't already complete (AC-06), and it
 * hasn't been dismissed for this task before (AC-02, persisted per task). Directly-navigated visits and
 * completed tasks show nothing — the spotlight is a response to following a task, not ambient decoration.
 */
export function GettingStartedSpotlight({
  taskId,
  anchorRef,
  title,
  body,
  icon,
}: GettingStartedSpotlightProps) {
  const location = useLocation();
  const tasksQuery = useGettingStartedTasks();
  const [dismissed, setDismissed] = useState(() => readDismissed().includes(taskId));

  const arrivedViaTask =
    (location.state as { gettingStarted?: OnboardingTaskId } | null)?.gettingStarted === taskId;
  const isComplete = tasksQuery.data?.completed.includes(taskId) ?? false;

  if (!arrivedViaTask || isComplete || dismissed) return null;

  const dismiss = () => {
    const next = Array.from(new Set([...readDismissed(), taskId]));
    persistDismissed(next);
    setDismissed(true);
  };

  const task = onboardingTaskById(taskId);
  return (
    <SpotlightCoachmark
      anchorRef={anchorRef}
      title={title ?? 'Start here'}
      body={body ?? task?.description ?? ''}
      {...(icon ? { icon } : {})}
      onDismiss={dismiss}
    />
  );
}
