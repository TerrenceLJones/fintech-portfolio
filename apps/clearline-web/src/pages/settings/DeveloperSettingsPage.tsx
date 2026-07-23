import { useNavigate } from 'react-router';
import { AccessDenied, Text } from '@clearline/ui';
import { DeveloperForbiddenError, useDeveloper } from '@clearline/data-access-developer';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { ToastViewport } from '../../components/ToastViewport';
import { useToast } from '../../hooks/useToast';
import { DEFAULT_SETTINGS_SLUG, settingsPathForSlug } from '../../rbac/settings-sections';
import { developerBeacon } from './developer.beacon';
import { ApiKeysSection } from './developer/ApiKeysSection';
import { WebhooksSection } from './developer/WebhooksSection';

/**
 * Settings → Developer (US-CW-041). An Admin/Owner-only surface for scoped API keys — created with a
 * reveal-once modal and masked thereafter (AC-01/02), revocable with a named confirmation (AC-04) — and
 * webhook endpoints with a reveal-once signing secret, HTTPS-only URLs, a delivery log with a resend
 * action and the retry schedule, and an HMAC verification reference (AC-06–09). Gated by
 * `developer:manage` — the data endpoint returns 403 independently and the page degrades to AccessDenied
 * (AC-10). Every mutation is audited server-side, never storing the full key or signing secret.
 */
export function DeveloperSettingsPage() {
  useDemoBeacon(developerBeacon);
  const navigate = useNavigate();
  const query = useDeveloper();
  const { toast, show: showToast } = useToast(4000);

  if (query.error instanceof DeveloperForbiddenError) {
    return (
      <AccessDenied
        message="Ask an admin if you need it. This settings section is available to a different role."
        requestLine="403 Forbidden · GET /api/developer"
        actionLabel="Back to Personal Info"
        onAction={() => navigate(settingsPathForSlug(DEFAULT_SETTINGS_SLUG))}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Text as="h2" size="heading">
          Developer
        </Text>
        <Text as="p" size="label" tone="muted" className="mt-1">
          Programmatic access to Clearline. Keys and signing secrets are shown once at creation and
          never again — store them securely.
        </Text>
      </div>

      {query.isPending || !query.data ? (
        <Text as="p" tone="muted">
          Loading developer settings…
        </Text>
      ) : (
        <>
          <ApiKeysSection apiKeys={query.data.apiKeys} onToast={showToast} />
          <WebhooksSection webhooks={query.data.webhooks} onToast={showToast} />
        </>
      )}

      <ToastViewport toast={toast} />
    </div>
  );
}
