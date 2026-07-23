import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  BillingErrorResponse,
  BillingSummary,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  UpdatePaymentMethodRequest,
  UpdatePaymentMethodResponse,
} from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { BillingService } from '../services/billing.service';
import { sharedAuditService } from '../services/shared-audit-service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedBillingService } from '../services/shared-billing-service';
import { resolveAuditActor } from './audit-actor';
import { bearerToken, unauthorizedForSession } from './session-auth';

export function createBillingHandlers(
  service: BillingService = sharedBillingService,
  authService: AuthService = sharedAuthService,
  auditService: AuditService = sharedAuditService,
): HttpHandler[] {
  /** billing:manage gate — Admin/Owner only (AC-08). Returns the caller's orgId, else a 401/403 status. */
  function authorize(
    request: Request,
  ): { ok: true; orgId: string } | { ok: false; status: 401 | 403 } {
    const token = bearerToken(request);
    const session = token ? authService.checkSession(token) : null;
    if (!session || session.outcome !== 'active') return { ok: false, status: 401 };

    const permissions = permissionsForRole(session.role!, {
      isAdmin: session.isAdmin!,
      isOwner: session.isOwner!,
    });
    if (!hasPermission(permissions, 'billing:manage')) return { ok: false, status: 403 };

    const orgId = authService.getOrgIdForUser(session.userId!);
    if (!orgId) return { ok: false, status: 403 };
    return { ok: true, orgId };
  }

  /** The org's authenticated caller (any role) — for the read-only status the app-wide banner reads (AC-07). */
  function callerOrgId(request: Request): string | null {
    const token = bearerToken(request);
    const session = token ? authService.checkSession(token) : null;
    if (!session || session.outcome !== 'active') return null;
    return authService.getOrgIdForUser(session.userId!);
  }

  function forbidden() {
    return HttpResponse.json<BillingErrorResponse>({ error: 'forbidden_role' }, { status: 403 });
  }

  function companyName(orgId: string): string {
    return authService.getCompanyProfile(orgId)?.legalName ?? 'your organization';
  }

  function record(request: Request, action: string, label: string) {
    const actor = resolveAuditActor(request, authService);
    if (!actor) return;
    auditService.record({ actor, category: 'billing', action, target: { label } });
  }

  return [
    // Plan/usage/payment/invoice summary — Admin/Owner only (AC-01/AC-08).
    http.get('*/api/billing', ({ request }) => {
      const authz = authorize(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      return HttpResponse.json<BillingSummary>(
        service.snapshot(authz.orgId, companyName(authz.orgId)),
        { status: 200 },
      );
    }),

    // Subscription status only — any authenticated user, so the read-only grace banner shows for every
    // role (AC-07). Deliberately NOT gated by billing:manage: it exposes no plan/usage/payment detail.
    http.get('*/api/billing/status', ({ request }) => {
      const orgId = callerOrgId(request);
      if (!orgId) return unauthorizedForSession(request, authService);
      return HttpResponse.json(service.status(orgId), { status: 200 });
    }),

    // Update the card on file via a mock Stripe token (AC-02). A decline leaves the method unchanged and
    // returns card_declined (AC-03); raw card data is never received and never audited (AC-09).
    http.post('*/api/billing/payment-method', async ({ request }) => {
      const authz = authorize(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const body = (await request.json()) as UpdatePaymentMethodRequest;
      const result = service.updatePaymentMethod(authz.orgId, body.paymentToken ?? '');
      if (result.outcome === 'declined') {
        return HttpResponse.json<BillingErrorResponse>({ error: 'card_declined' }, { status: 402 });
      }
      record(
        request,
        'Updated payment method',
        `${result.paymentMethod.brand} ···· ${result.paymentMethod.last4}`,
      );
      return HttpResponse.json<UpdatePaymentMethodResponse>(
        { paymentMethod: result.paymentMethod },
        { status: 200 },
      );
    }),

    // Cancel the subscription (AC-05/AC-06). The exact company name must be typed to confirm; a mismatch
    // is rejected and nothing is cancelled. On success cancellation is scheduled for period-end and a
    // final confirmation would be emailed to all admins (mocked).
    http.post('*/api/billing/cancel', async ({ request }) => {
      const authz = authorize(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const body = (await request.json()) as CancelSubscriptionRequest;
      const expected = companyName(authz.orgId);
      if ((body.confirmationName ?? '').trim() !== expected) {
        return HttpResponse.json<BillingErrorResponse>({ error: 'name_mismatch' }, { status: 422 });
      }
      const result = service.cancelSubscription(authz.orgId);
      record(request, 'Cancelled subscription', `Access until ${result.accessUntil}`);
      return HttpResponse.json<CancelSubscriptionResponse>(
        { status: 'canceled_grace', accessUntil: result.accessUntil },
        { status: 200 },
      );
    }),

    // Download a past invoice as a period-named PDF (AC-04).
    http.get('*/api/billing/invoices/:id/pdf', ({ request, params }) => {
      const authz = authorize(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const pdf = service.invoicePdf(authz.orgId, String(params.id));
      if (!pdf) {
        return HttpResponse.json<BillingErrorResponse>(
          { error: 'forbidden_role' },
          { status: 404 },
        );
      }
      return new HttpResponse(pdf.bytes, {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `attachment; filename="${pdf.filename}"`,
        },
      });
    }),
  ];
}

export const billingHandlers = createBillingHandlers();
