import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  SettingsErrorResponse,
  SettingsSectionAccessResponse,
  SettingsSectionSlug,
} from '@clearline/contracts';
import {
  hasPermission,
  permissionForSettingsSection,
  permissionsForRole,
} from '@clearline/domain-auth';
import { AuthService } from '../services/auth.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { bearerToken, unauthorizedForSession } from './session-auth';

function forbidden() {
  const body: SettingsErrorResponse = { error: 'forbidden_role' };
  return HttpResponse.json(body, { status: 403 });
}

/**
 * Thin HTTP adapter for the /settings surface authorization check (US-CW-033 AC-04). Each org-settings
 * route is guarded on the client by RequirePermission, but "client hides, server decides": this
 * endpoint independently re-derives the caller's permissions from their live session and re-checks the
 * section's requirement, so navigating directly to an unauthorized settings URL is refused by the API
 * regardless of how the client routed. Profile sections (personal/security/notifications) require no
 * permission; an unknown slug is a 404 so a mistyped route can't be mistaken for an authorized one.
 * Later section stories add their own data endpoints; this one governs reachability.
 */
export function createSettingsHandlers(
  authService: AuthService = sharedAuthService,
): HttpHandler[] {
  return [
    http.get('*/api/settings/sections/:slug', ({ request, params }) => {
      const accessToken = bearerToken(request);
      const session = accessToken ? authService.checkSession(accessToken) : null;
      if (!session || session.outcome !== 'active') {
        return unauthorizedForSession(request, authService);
      }

      const slug = String(params.slug);
      const required = permissionForSettingsSection(slug);
      if (required === undefined) {
        return new HttpResponse(null, { status: 404 });
      }

      if (required !== null) {
        const permissions = permissionsForRole(session.role!, {
          isAdmin: session.isAdmin!,
          isOwner: session.isOwner!,
        });
        if (!hasPermission(permissions, required)) {
          return forbidden();
        }
      }

      const body: SettingsSectionAccessResponse = {
        slug: slug as SettingsSectionSlug,
        authorized: true,
      };
      return HttpResponse.json(body, { status: 200 });
    }),
  ];
}

export const settingsHandlers = createSettingsHandlers();
