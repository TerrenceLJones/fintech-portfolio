import { http, HttpResponse, type HttpHandler } from 'msw';
import type { OnboardingTaskId, OnboardingTasksResponse } from '@clearline/contracts';
import { AuthService } from '../services/auth.service';
import { OnboardingTasksService } from '../services/onboarding-tasks.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedOnboardingTasksService } from '../services/shared-onboarding-tasks-service';
import { resolveAuditActor } from './audit-actor';
import { unauthorizedForSession } from './session-auth';

/**
 * Only "visit" tasks may be completed through this client-facing endpoint — the guidance for those is
 * "go look at this page", so reaching the page IS the observed action. Every other task ("event"
 * tasks: submit an expense, issue a card, invite a teammate, …) is recorded server-side at its own
 * mutation call site and can never be completed from the client (US-CW-047 AC-02): there is no path
 * for the launcher to self-report an action the user hasn't performed.
 */
const VISIT_TASK_IDS: readonly OnboardingTaskId[] = [
  'see-cards',
  'read-dashboard',
  'reconcile-transactions',
  'review-audit',
];

/**
 * Every task id — used only by the dev/demo force-complete endpoint below, so the Demo Beacon can drive
 * the launcher to any state (progress the checklist, trip the milestone, retire it) without staging a
 * multi-user flow such as an employee submitting an expense for an approver to clear. This is a testing
 * affordance on the mock backend, deliberately separate from the honest `/complete` endpoint (which
 * still refuses event tasks) so the real completion path stays event-observed only.
 */
const ALL_TASK_IDS: readonly OnboardingTaskId[] = [
  'submit-expense',
  'see-cards',
  'clear-approval',
  'read-dashboard',
  'send-payment',
  'reconcile-transactions',
  'issue-card',
  'set-budget',
  'review-audit',
  'invite-team',
];

function tasksBody(service: OnboardingTasksService, userId: string): OnboardingTasksResponse {
  return {
    completed: service.getCompleted(userId),
    milestoneShown: service.isMilestoneShown(userId),
  };
}

/**
 * Thin HTTP adapter in front of OnboardingTasksService (EPIC-CW-023). The caller is always resolved
 * from their own access token — never client claims — via resolveAuditActor, the same server-derived
 * identity the audit trail uses. There is deliberately no endpoint to mark an "event" task done: the
 * launcher is a read model over real activity (US-CW-047), so the only writes are (a) the visit-task
 * completion below, (b) the milestone latch, and (c) the dev/demo reset — plus the completion calls
 * the financial-flow emitters make directly against the shared service.
 */
export function createOnboardingTasksHandlers(
  service: OnboardingTasksService = sharedOnboardingTasksService,
  authService: AuthService = sharedAuthService,
): HttpHandler[] {
  return [
    http.get('*/api/onboarding/tasks', ({ request }) => {
      const actor = resolveAuditActor(request, authService);
      if (!actor) return unauthorizedForSession(request, authService);
      return HttpResponse.json(tasksBody(service, actor.id), { status: 200 });
    }),

    http.post('*/api/onboarding/tasks/:id/complete', ({ request, params }) => {
      const actor = resolveAuditActor(request, authService);
      if (!actor) return unauthorizedForSession(request, authService);

      const id = String(params.id) as OnboardingTaskId;
      if (!VISIT_TASK_IDS.includes(id)) {
        // An event task can only be completed by performing its action, never via this endpoint.
        return HttpResponse.json({ error: 'not_completable' }, { status: 400 });
      }
      service.markComplete(actor.id, id);
      return HttpResponse.json(tasksBody(service, actor.id), { status: 200 });
    }),

    // Dev/demo only (see ALL_TASK_IDS): force a task complete regardless of its trigger, for the
    // Demo Beacon's "trigger completion" shortcuts. Not part of the honest event-observed path.
    http.post('*/api/onboarding/tasks/:id/force-complete', ({ request, params }) => {
      const actor = resolveAuditActor(request, authService);
      if (!actor) return unauthorizedForSession(request, authService);

      const id = String(params.id) as OnboardingTaskId;
      if (!ALL_TASK_IDS.includes(id)) {
        return HttpResponse.json({ error: 'unknown_task' }, { status: 400 });
      }
      service.markComplete(actor.id, id);
      return HttpResponse.json(tasksBody(service, actor.id), { status: 200 });
    }),

    http.post('*/api/onboarding/milestone', ({ request }) => {
      const actor = resolveAuditActor(request, authService);
      if (!actor) return unauthorizedForSession(request, authService);
      service.markMilestoneShown(actor.id);
      return HttpResponse.json(tasksBody(service, actor.id), { status: 200 });
    }),

    http.post('*/api/onboarding/tasks/reset', ({ request }) => {
      const actor = resolveAuditActor(request, authService);
      if (!actor) return unauthorizedForSession(request, authService);
      service.reset(actor.id);
      return HttpResponse.json(tasksBody(service, actor.id), { status: 200 });
    }),
  ];
}

export const onboardingTasksHandlers = createOnboardingTasksHandlers();
