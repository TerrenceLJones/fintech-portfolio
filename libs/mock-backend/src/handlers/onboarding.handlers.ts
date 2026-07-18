import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  AddOwnerRequest,
  AddOwnerResponse,
  CompleteStepResponse,
  OnboardingErrorResponse,
  OnboardingStatusResponse,
  OnboardingStepId,
  SubmitBusinessInfoRequest,
  SubmitBusinessInfoResponse,
  SubmitDocumentRequest,
  SubmitDocumentResponse,
  SubmitReviewResponse,
} from '@clearline/contracts';
import { AuthService } from '../services/auth.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { OnboardingService } from '../services/onboarding.service';
import { sharedOnboardingService } from '../services/shared-onboarding-service';

/** Resolves both the userId and email of an active session — the email is needed to elevate the account creator on KYB approval (setUserRole is keyed by email). Null if not an active session. */
function resolveActiveSession(
  request: Request,
  authService: AuthService,
): { userId: string; email: string } | null {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!accessToken) return null;

  const result = authService.checkSession(accessToken);
  if (result.outcome !== 'active') return null;
  return { userId: result.userId!, email: result.email! };
}

/** Resolves just the requesting userId from the Bearer access token, or null if it isn't a currently-active session. */
function resolveUserId(request: Request, authService: AuthService): string | null {
  return resolveActiveSession(request, authService)?.userId ?? null;
}

const UNAUTHENTICATED: OnboardingErrorResponse = { error: 'unauthenticated' };

/** Thin HTTP adapter in front of OnboardingService — the actual rules live in the service, not here. */
export function createOnboardingHandlers(
  onboardingService: OnboardingService = sharedOnboardingService,
  authService: AuthService = sharedAuthService,
): HttpHandler[] {
  return [
    http.get('*/api/onboarding/status', ({ request }) => {
      const userId = resolveUserId(request, authService);
      if (!userId) return HttpResponse.json(UNAUTHENTICATED, { status: 401 });

      const body: OnboardingStatusResponse = onboardingService.getStatus(userId);
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/onboarding/business', async ({ request }) => {
      const userId = resolveUserId(request, authService);
      if (!userId) return HttpResponse.json(UNAUTHENTICATED, { status: 401 });

      const business = (await request.json()) as SubmitBusinessInfoRequest;
      const result = await onboardingService.submitBusinessInfo(userId, business);

      const body: SubmitBusinessInfoResponse = { outcome: result.outcome };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/onboarding/owners', async ({ request }) => {
      const userId = resolveUserId(request, authService);
      if (!userId) return HttpResponse.json(UNAUTHENTICATED, { status: 401 });

      const input = (await request.json()) as AddOwnerRequest;
      const result = await onboardingService.addOwner(userId, input);

      const body: AddOwnerResponse = { owner: result.owner };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/onboarding/steps/:step/complete', ({ request, params }) => {
      const userId = resolveUserId(request, authService);
      if (!userId) return HttpResponse.json(UNAUTHENTICATED, { status: 401 });

      onboardingService.completeStep(userId, params.step as OnboardingStepId);

      const body: CompleteStepResponse = {};
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/onboarding/documents', async ({ request }) => {
      const userId = resolveUserId(request, authService);
      if (!userId) return HttpResponse.json(UNAUTHENTICATED, { status: 401 });

      const document = (await request.json()) as SubmitDocumentRequest;
      const result = onboardingService.submitDocument(userId, document);

      const body: SubmitDocumentResponse = result;
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/onboarding/review/submit', ({ request }) => {
      const session = resolveActiveSession(request, authService);
      if (!session) return HttpResponse.json(UNAUTHENTICATED, { status: 401 });

      const result = onboardingService.submitReview(session.userId);

      // KYB approval is where an Organization comes into existence and the account creator becomes its
      // Owner (US-CW-030 AC-01/AC-02): onboarding is a business-level concern, RBAC a per-person one,
      // and they meet exactly here — provisioned as one atomic transition so no state exists where the
      // business is approved but has no Organization or no Owner. Guarded on three counts: the outcome
      // is approved (not an under_review compliance hold); this call is the transition into that status,
      // not a re-submission (finalizedNow), so an owner is never re-provisioned over a later change; and
      // the KYB record is genuinely complete, so a bare submit that skips the wizard can't confer full
      // financial authority. The org is keyed to the verified business's legal name + EIN, and the
      // elevation reads through on the creator's very next session check.
      if (
        result.outcome === 'approved' &&
        result.finalizedNow &&
        onboardingService.isKybComplete(session.userId)
      ) {
        const business = onboardingService.getStatus(session.userId).business;
        if (business) {
          authService.provisionOrganizationForOwner(session.email, {
            legalName: business.legalName,
            ein: business.ein,
          });
        }
      }

      const body: SubmitReviewResponse = { outcome: result.outcome };
      return HttpResponse.json(body, { status: 200 });
    }),
  ];
}

export const onboardingHandlers = createOnboardingHandlers();
