import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentContextResponse,
  PaymentErrorResponse,
  PaymentIntentResponse,
  SessionErrorResponse,
  StepUpChallengeResponse,
  StepUpErrorResponse,
  StepUpMethod,
  StepUpVerifyRequest,
  StepUpVerifyResponse,
} from '@clearline/contracts';
import type { CreatePaymentRequest as PaymentRequest, PaymentIntent } from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import { AuthService } from '../services/auth.service';
import { PaymentsService, type PaymentActor } from '../services/payments.service';
import { AuditService } from '../services/audit.service';
import { BillingService } from '../services/billing.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedPaymentsService } from '../services/shared-payments-service';
import { sharedAuditService } from '../services/shared-audit-service';
import { sharedBillingService } from '../services/shared-billing-service';
import { OnboardingTasksService } from '../services/onboarding-tasks.service';
import { sharedOnboardingTasksService } from '../services/shared-onboarding-tasks-service';
import { formatAuditMoney, resolveAuditActor } from './audit-actor';

/**
 * Resolves the acting payer from the request's own access token — never from anything the client
 * claims. Permissions are derived server-side from the resolved role, so `payments:create` is
 * re-checked here regardless of what the UI rendered (US-CW-008: the client is never the boundary).
 */
function resolveActor(request: Request, authService: AuthService): PaymentActor | null {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!accessToken) return null;

  const session = authService.checkSession(accessToken);
  if (session.outcome !== 'active') return null;

  return {
    userId: session.userId!,
    displayName: session.displayName!,
    permissions: permissionsForRole(session.role!, {
      isAdmin: session.isAdmin!,
      isOwner: session.isOwner!,
    }),
  };
}

const unauthorized = () =>
  HttpResponse.json({ error: 'invalid_token' } satisfies SessionErrorResponse, { status: 401 });

const forbidden = () =>
  HttpResponse.json({ error: 'forbidden' } satisfies PaymentErrorResponse, { status: 403 });

/** Thin HTTP adapter in front of PaymentsService — the validation/idempotency rules live in the service/domain. */
export function createPaymentsHandlers(
  paymentsService: PaymentsService = sharedPaymentsService,
  authService: AuthService = sharedAuthService,
  auditService: AuditService = sharedAuditService,
  billingService: BillingService = sharedBillingService,
  onboardingTasksService: OnboardingTasksService = sharedOnboardingTasksService,
): HttpHandler[] {
  /**
   * Record a payment submission in the central audit log (US-CW-021 AC-01). Emitted regardless of
   * outcome — a successful submit, a step-up hold, and a validation rejection are all recorded — so a
   * failed or rejected payment is auditable too. Captures the actor, amount, recipient, idempotency
   * key, and outcome; the timestamp is stamped by the audit store.
   */
  function recordSubmission(
    request: Request,
    payload: PaymentRequest,
    idempotencyKey: string,
    outcome: string,
    intent?: PaymentIntent,
  ) {
    const actor = resolveAuditActor(request, authService);
    if (!actor) return;
    const recipient = intent?.recipientName ?? payload.recipientId ?? 'hand-entered recipient';
    auditService.record({
      actor,
      category: 'payment',
      action: 'Submitted payment',
      ...(intent ? { target: { label: intent.id, ref: intent.id } } : {}),
      detail: `${formatAuditMoney(payload.amount)} → ${recipient}`,
      meta: { amount: payload.amount, recipient, idempotencyKey, outcome },
    });
  }

  return [
    http.get('*/api/payments/context', ({ request }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();
      if (!hasPermission(actor.permissions, 'payments:create')) return forbidden();

      const body: PaymentContextResponse = paymentsService.getContext();
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/payments/fx', ({ request }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();
      if (!hasPermission(actor.permissions, 'payments:create')) return forbidden();

      const url = new URL(request.url);
      const from = url.searchParams.get('from') ?? '';
      const to = url.searchParams.get('to') ?? '';
      const amount = Number(url.searchParams.get('amount') ?? '0');
      const quote = paymentsService.getExchangeRate(from, to, amount);
      if (!quote) return HttpResponse.json({ error: 'unsupported_currency' }, { status: 404 });
      return HttpResponse.json(quote, { status: 200 });
    }),

    http.post('*/api/payments', async ({ request }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();

      // Post-cancellation read-only grace (US-CW-042 AC-07): once the subscription is cancelled, no new
      // financial objects may be created even though read-only access continues. Enforced server-side so
      // the client can never route around it. (Payments is the representative "new transaction" path;
      // extending the same guard to card issuance and approval creation is tracked as follow-up.)
      const orgId = authService.getOrgIdForUser(actor.userId);
      if (orgId && billingService.isReadOnly(orgId)) {
        return HttpResponse.json({ error: 'subscription_canceled' }, { status: 403 });
      }

      const idempotencyKey = request.headers.get('idempotency-key');
      if (!idempotencyKey) {
        return HttpResponse.json({ error: 'missing_idempotency_key' }, { status: 400 });
      }

      const payload = (await request.json()) as CreatePaymentRequest;
      const result = paymentsService.createPayment(payload, idempotencyKey, actor);

      if (result.outcome === 'forbidden') return forbidden();
      if (result.outcome === 'idempotency_mismatch') {
        return HttpResponse.json({ error: 'idempotency_mismatch' } satisfies PaymentErrorResponse, {
          status: 409,
        });
      }
      if (result.outcome === 'validation_error') {
        // A rejected submission is still an auditable attempt (AC-01) — recorded with its reason.
        recordSubmission(request, payload, idempotencyKey, `rejected · ${result.reason}`);
        const body: PaymentErrorResponse = {
          error: result.reason,
          ...(result.availableBalance ? { availableBalance: result.availableBalance } : {}),
          ...(result.dailyLimit ? { dailyLimit: result.dailyLimit } : {}),
        };
        return HttpResponse.json(body, { status: 422 });
      }
      // A high-value payment comes back reserved with a step-up challenge attached (US-CW-010 AC-01).
      if (result.outcome === 'requires_action') {
        recordSubmission(request, payload, idempotencyKey, 'step-up required', result.intent);
        const body: CreatePaymentResponse = { intent: result.intent, challenge: result.challenge };
        return HttpResponse.json(body, { status: 200 });
      }
      recordSubmission(request, payload, idempotencyKey, 'submitted', result.intent);
      // A payment that clears without step-up completes the "Send a payment" getting-started task.
      onboardingTasksService.markComplete(actor.userId, 'send-payment');
      const body: CreatePaymentResponse = { intent: result.intent };
      return HttpResponse.json(body, { status: 200 });
    }),

    // Step-up verify (US-CW-010 AC-02/AC-04/AC-06). A wrong code (otp_incorrect) and an expired code
    // (otp_expired, with a freshly issued challenge) are both 422 the client renders distinctly; a
    // connectivity failure never reaches here, so the client owns that (AC-07) path.
    http.post('*/api/payments/:id/challenge/verify', async ({ request, params }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();
      if (!hasPermission(actor.permissions, 'payments:create')) return forbidden();

      const { code } = (await request.json()) as StepUpVerifyRequest;
      const result = paymentsService.verifyStepUp(String(params.id), code);

      if (result.outcome === 'not_found') {
        return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (result.outcome === 'verified') {
        // A high-value payment finalized through step-up still completes the "Send a payment" task.
        onboardingTasksService.markComplete(actor.userId, 'send-payment');
        const body: StepUpVerifyResponse = { intent: result.intent };
        return HttpResponse.json(body, { status: 200 });
      }
      if (result.outcome === 'expired') {
        const body: StepUpErrorResponse = { error: 'otp_expired', challenge: result.challenge };
        return HttpResponse.json(body, { status: 422 });
      }
      if (result.outcome === 'locked') {
        return HttpResponse.json({ error: 'locked' } satisfies StepUpErrorResponse, {
          status: 422,
        });
      }
      return HttpResponse.json({ error: 'otp_incorrect' } satisfies StepUpErrorResponse, {
        status: 422,
      });
    }),

    // Step-up resend / "Try another method" (US-CW-010 AC-05) — issues a new code, optionally on a
    // different channel, and invalidates the previous one server-side.
    http.post('*/api/payments/:id/challenge/resend', async ({ request, params }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();
      if (!hasPermission(actor.permissions, 'payments:create')) return forbidden();

      const payload = (await request.json().catch(() => ({}))) as { method?: StepUpMethod };
      const result = paymentsService.resendStepUp(String(params.id), payload.method);
      if (result.outcome === 'not_found') {
        return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      }
      const body: StepUpChallengeResponse = { challenge: result.challenge };
      return HttpResponse.json(body, { status: 200 });
    }),

    // Webhook-driven reversal (US-CW-009 AC-02) — a server-to-server event, not a user-authenticated call.
    http.post('*/api/payments/:id/reverse', ({ params }) => {
      const result = paymentsService.reverse(String(params.id));
      if (result.outcome === 'not_found') {
        return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      }
      const body: PaymentIntentResponse = { intent: result.intent };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/payments/:id', ({ request, params }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();
      if (!hasPermission(actor.permissions, 'payments:create')) return forbidden();

      const intent = paymentsService.getIntent(String(params.id));
      if (!intent) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      const body: PaymentIntentResponse = { intent };
      return HttpResponse.json(body, { status: 200 });
    }),
  ];
}

export const paymentsHandlers = createPaymentsHandlers();
