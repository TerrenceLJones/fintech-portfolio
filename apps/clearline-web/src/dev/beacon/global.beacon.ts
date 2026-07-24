import type { ActionsSection, DemoBeaconPageConfig, FlowsSection } from '@clearline/demo-beacon';
import { DEMO_USER_PASSWORD } from '@clearline/mock-backend/fixtures';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { notifyOnboardingTasksChanged } from '@clearline/data-access-onboarding';
import { DEMO_EMAIL } from './shared';
import { resetDemoState } from '../reset-demo-state';
import { ONBOARDING_TASK_IDS, onboardingTaskById } from '../../rbac/onboarding-tasks';

/** Client-side key the on-page spotlight uses to remember per-task dismissals (US-CW-046 AC-02). */
const SPOTLIGHT_DISMISSED_KEY = 'clearline:gs-spotlight-dismissed';

/**
 * Reset just the getting-started onboarding (EPIC-CW-023) for the current user — without the full
 * "Reset demo data" teardown, so the tester stays signed in and can replay the first-run experience
 * from the top. Clears the server-side task-completion read model + the once-per-user milestone latch,
 * and the client-side per-task spotlight dismissals, so the rail entry, panel, spotlights, and
 * milestone Toast all return to their fresh state. The launcher refetches on the next window focus.
 */
async function resetGettingStarted(): Promise<void> {
  await authenticatedFetch('/api/onboarding/tasks/reset', { method: 'POST' });
  try {
    sessionStorage.removeItem(SPOTLIGHT_DISMISSED_KEY);
  } catch {
    /* sessionStorage unavailable — nothing to clear */
  }
  notifyOnboardingTasksChanged();
}

/**
 * Force a single getting-started task complete for the current user — a dev/demo shortcut so a tester
 * can drive the launcher to any state without staging the real multi-user flow. "Clear your first
 * approval", for instance, normally needs another member to submit an expense into the queue first;
 * this ticks it off directly. Completion is still recorded server-side (the launcher refetches on the
 * next window focus) and completing a signature task trips its milestone Toast, exactly as the real
 * event would.
 */
async function forceCompleteTask(id: string): Promise<void> {
  await authenticatedFetch(`/api/onboarding/tasks/${id}/force-complete`, { method: 'POST' });
  notifyOnboardingTasksChanged();
}

/**
 * One "complete this task" button per getting-started task (US-CW-045), signatures first. Lets a
 * tester progress the checklist, trip the milestone, and watch the launcher retire — without logging
 * in as another persona to generate the underlying events.
 */
export const completeGettingStartedTaskSection: ActionsSection = {
  kind: 'actions',
  title: 'Trigger getting-started completion (dev)',
  actions: ONBOARDING_TASK_IDS.map((id) => ({
    id: `gs-complete-${id}`,
    label: `Complete · ${onboardingTaskById(id)?.title ?? id}`,
    run: () => forceCompleteTask(id),
  })),
};

/**
 * A targeted "Reset getting-started" control for testing EPIC-CW-023. Shared into the pages a tester
 * replays onboarding from. Unlike the full demo reset above it preserves the session, so the tester
 * can watch the launcher, spotlights, and milestone reappear without signing back in.
 */
export const resetGettingStartedSection: ActionsSection = {
  kind: 'actions',
  title: 'Getting-started onboarding',
  actions: [
    {
      id: 'reset-getting-started',
      label: 'Reset getting-started',
      description:
        'Clears this user’s getting-started task progress, the milestone celebration, and dismissed spotlights so the first-run experience replays. Keeps you signed in.',
      run: resetGettingStarted,
    },
  ],
};

/**
 * How the role-based getting-started layer (EPIC-CW-023) works, for a tester exploring it. Completion
 * is observed from real actions — there is no "mark done" button anywhere — so the way to advance the
 * checklist is to actually perform each task.
 */
export const gettingStartedGuide: FlowsSection = {
  kind: 'flows',
  title: 'Getting-started onboarding (EPIC-CW-023)',
  flows: [
    {
      id: 'getting-started',
      title: 'Find your role’s first action',
      steps: [
        {
          text: 'Look at the **Getting started** row pinned at the foot of the sidebar rail, just above your identity footer — a slim progress bar with an "X of N" count (US-CW-044). It only appears while your role has incomplete tasks, and retires once they are all done.',
        },
        {
          text: 'Open it to see the **role-scoped checklist** (US-CW-045). The Owner gets a "set up your workspace" script led by *Invite your team*; a Finance Manager leads with *Clear your first approval*; an invited Controller with *Issue your first virtual card*; an Employee with *Submit your first expense*. You only ever see tasks your permissions allow.',
        },
        {
          text: 'Pick a task — it deep-links to where that work happens and, on the action pages, points out the primary control with a **spotlight** (US-CW-046). There is deliberately no "mark done" control.',
        },
        {
          text: 'Complete the action for real (submit the expense, issue the card, invite the teammate…). The task ticks off from the **observed event** (US-CW-047), and finishing your role’s signature action fires one modest milestone Toast.',
        },
        {
          text: 'Use **Reset getting-started** below to replay the whole thing from a fresh first-run without signing out.',
        },
      ],
    },
  ],
};

/**
 * The app-wide "Reset demo data" action, gated behind a confirm because it discards a tester's
 * in-progress work. Shared into the pages a tester is most likely to reset from.
 */
export const resetSection: ActionsSection = {
  kind: 'actions',
  title: 'Demo controls',
  actions: [
    {
      id: 'reset',
      label: 'Reset demo data',
      description: 'Clears role changes, payments, and onboarding progress back to the seed.',
      variant: 'destructive',
      confirm: 'This discards in-progress work.',
      run: resetDemoState,
    },
  ],
};

/**
 * Shown when no page has registered its own guide (e.g. a route we haven't documented). Orients a
 * first-time viewer and hands them the demo login.
 */
export const globalBeacon: DemoBeaconPageConfig = {
  pageId: 'global.fallback',
  title: 'Clearline demo',
  summary:
    'A B2B spend-management demo running entirely on a mock backend — no real API. Sign in with the seeded account and explore.',
  sections: [
    {
      kind: 'copyable',
      title: 'Demo login',
      items: [
        { label: 'Email', value: DEMO_EMAIL },
        { label: 'Password', value: DEMO_USER_PASSWORD },
      ],
    },
    {
      kind: 'text',
      title: 'Tip',
      body: 'Open this guide on any page — it changes to show what **that** page supports.',
    },
    {
      kind: 'flows',
      title: 'Sign out (US-CW-048)',
      flows: [
        {
          id: 'logout',
          title: 'Log out from the identity footer',
          steps: [
            {
              text: 'Click your name in the **identity footer** at the bottom of the sidebar rail to open the user menu (US-CW-032). It is keyboard-operable and closes on Escape or an outside click (AC-01).',
            },
            {
              text: 'Choose **Log out**. Clearline revokes the session server-side, clears the in-memory tokens, and returns you to the login screen; a failed or offline revoke still signs you out cleanly (AC-02/03/05).',
            },
            {
              text: 'Choose **Manage account** instead to jump straight to Personal Info / Security — the same menu carries both actions (the US-CW-032 update).',
            },
          ],
        },
      ],
    },
    gettingStartedGuide,
    completeGettingStartedTaskSection,
    resetGettingStartedSection,
    resetSection,
  ],
};
