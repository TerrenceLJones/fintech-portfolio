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

/** Resolves the requesting userId from the Bearer access token, or null if it isn't a currently-active session. */
function resolveUserId(request: Request, authService: AuthService): string | null {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!accessToken) return null;

  const result = authService.checkSession(accessToken);
  return result.outcome === 'active' ? result.userId! : null;
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
      const userId = resolveUserId(request, authService);
      if (!userId) return HttpResponse.json(UNAUTHENTICATED, { status: 401 });

      const result = onboardingService.submitReview(userId);

      const body: SubmitReviewResponse = { outcome: result.outcome };
      return HttpResponse.json(body, { status: 200 });
    }),
  ];
}

export const onboardingHandlers = createOnboardingHandlers();
