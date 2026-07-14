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
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import { AuthService } from '../services/auth.service';
import { PaymentsService, type PaymentActor } from '../services/payments.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedPaymentsService } from '../services/shared-payments-service';

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
    permissions: permissionsForRole(session.role!, { isAdmin: session.isAdmin! }),
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
): HttpHandler[] {
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
        const body: PaymentErrorResponse = {
          error: result.reason,
          ...(result.availableBalance ? { availableBalance: result.availableBalance } : {}),
          ...(result.dailyLimit ? { dailyLimit: result.dailyLimit } : {}),
        };
        return HttpResponse.json(body, { status: 422 });
      }
      // A high-value payment comes back reserved with a step-up challenge attached (US-CW-010 AC-01).
      if (result.outcome === 'requires_action') {
        const body: CreatePaymentResponse = { intent: result.intent, challenge: result.challenge };
        return HttpResponse.json(body, { status: 200 });
      }
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
