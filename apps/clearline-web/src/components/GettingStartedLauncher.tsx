import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  GettingStartedPanel,
  GettingStartedRailEntry,
  type GettingStartedTaskView,
} from '@clearline/ui';
import { useAuthorization } from '@clearline/data-access-auth';
import {
  useCompleteGettingStartedVisit,
  useGettingStartedTasks,
  useMarkGettingStartedMilestone,
} from '@clearline/data-access-onboarding';
import type { OnboardingTaskId } from '@clearline/contracts';
import { onboardingTasksForPermissions } from '../rbac/onboarding-tasks';
import { useToast } from '../hooks/useToast';
import { ToastViewport } from './ToastViewport';

/** The one-line milestone celebration per persona's signature action (US-CW-047 AC-03). */
const MILESTONE_MESSAGE: Partial<Record<OnboardingTaskId, string>> = {
  'submit-expense': 'Nice — first expense submitted',
  'clear-approval': 'First approval cleared — nicely done',
  'issue-card': 'First card issued — your program is live',
  'invite-team': 'Team invited — your workspace is live',
};

/**
 * The getting-started launcher (EPIC-CW-023) — always mounted in the app shell via AppShell's
 * `gettingStarted` slot, so it rides every authenticated page without per-route wiring. It owns the
 * whole launcher lifecycle:
 *
 *  - computes the role-scoped task set from the permission predicate + isOwner/isAdmin (US-CW-045),
 *    recomputing on the same session refetch that re-renders the nav (US-CW-044 AC-08);
 *  - reads completion from the server read-model (US-CW-047) and renders the rail entry + panel
 *    (US-CW-044), retiring when every task is done (AC-06) or staying absent when the role has none
 *    (AC-07);
 *  - deep-links a chosen task, carrying the getting-started intent as navigation state so the
 *    destination page can show its spotlight (US-CW-046 AC-05);
 *  - marks "visit" tasks complete when the user reaches their destination page — centralized here off
 *    the location, so view-only pages need no per-page wiring;
 *  - fires the single signature milestone Toast, once per user (US-CW-047 AC-03).
 */
export function GettingStartedLauncher() {
  const { can, isOwner, isAdmin, isLoading } = useAuthorization();
  const tasksQuery = useGettingStartedTasks();
  const completeVisit = useCompleteGettingStartedVisit();
  const markMilestone = useMarkGettingStartedMilestone();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, show } = useToast(6000);

  const [open, setOpen] = useState(false);
  const celebratedRef = useRef(false);
  // Wraps the rail entry + panel so the panel's click-away treats a click on the rail entry as
  // "inside" — otherwise the click-away would close the panel a beat before the toggle reopens it.
  const boundaryRef = useRef<HTMLDivElement>(null);

  const tasks = onboardingTasksForPermissions(can, { isOwner, isAdmin });
  const data = tasksQuery.data;
  const completed = data?.completed ?? [];
  const completedSet = new Set<OnboardingTaskId>(completed);

  // Mark a "visit" task complete once the user reaches its destination page (US-CW-047, view path).
  // Centralized here off the location so no view-only page needs to call anything.
  useEffect(() => {
    if (isLoading || !data) return;
    const here = tasks.find(
      (task) =>
        task.completion.kind === 'visit' &&
        task.path === location.pathname &&
        !completedSet.has(task.id),
    );
    if (here && !completeVisit.isPending) completeVisit.mutate(here.id);
    // completedSet/tasks derive from the same query data; keying on the primitives avoids a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isLoading, data]);

  // Fire the signature milestone celebration exactly once (US-CW-047 AC-03). The server latch
  // (milestoneShown) survives reloads; the ref guards against a double-fire within this mount before
  // the latch refetches.
  const signature = tasks.find((task) => task.isSignature);
  const signatureDone = signature ? completedSet.has(signature.id) : false;
  useEffect(() => {
    if (isLoading || !data || !signature) return;
    if (signatureDone && !data.milestoneShown && !celebratedRef.current) {
      celebratedRef.current = true;
      show(MILESTONE_MESSAGE[signature.id] ?? 'Milestone reached');
      markMilestone.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatureDone, data, isLoading]);

  // Suppress the launcher until the session and read-model resolve, when the role has no tasks
  // (AC-07), or once every task is done (AC-06). The milestone Toast still renders so completing the
  // final signature task both celebrates and retires the launcher.
  const total = tasks.length;
  const doneCount = tasks.filter((task) => completedSet.has(task.id)).length;
  const retired = total === 0 || doneCount >= total;

  if (isLoading || !data) {
    return <ToastViewport toast={toast} tone="positive" />;
  }

  const currentIndex = tasks.findIndex((task) => !completedSet.has(task.id));
  const views: GettingStartedTaskView[] = tasks.map((task, index) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    icon: task.icon,
    cta: task.cta,
    isSignature: task.isSignature,
    status: completedSet.has(task.id) ? 'done' : index === currentIndex ? 'current' : 'upcoming',
  }));

  const selectTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    setOpen(false);
    // Carry the getting-started intent so the destination page shows its spotlight (US-CW-046 AC-05).
    navigate(task.path, { state: { gettingStarted: task.id } });
  };

  return (
    <>
      {retired ? null : (
        <div ref={boundaryRef}>
          <GettingStartedRailEntry
            completedCount={doneCount}
            totalCount={total}
            open={open}
            onClick={() => setOpen((prev) => !prev)}
          />
          {open ? (
            <div className="fixed bottom-4 left-4 z-50 md:left-56">
              <GettingStartedPanel
                title={isOwner ? 'Set up your workspace' : 'Get started'}
                subtitle={isOwner ? 'Four steps to get your team spending safely.' : undefined}
                completedCount={doneCount}
                totalCount={total}
                tasks={views}
                onSelectTask={selectTask}
                onClose={() => setOpen(false)}
                boundaryRef={boundaryRef}
              />
            </div>
          ) : null}
        </div>
      )}
      <ToastViewport toast={toast} tone="positive" />
    </>
  );
}
