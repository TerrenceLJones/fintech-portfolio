import { useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Icon, Text } from '@clearline/ui';
import { useSession } from '@clearline/data-access-auth';
import { TotpSetupDialog } from './settings/security/TotpSetupDialog';
import { useTotpSetup } from './settings/security/use-totp-setup';

/**
 * The org-required-2FA setup gate (US-CW-040 AC-04). Reached only when the session carries
 * `twoFactorSetupRequired` — the member has completed password auth but their org mandates 2FA and they
 * haven't enrolled. It reuses the US-CW-035 TOTP setup flow; on completion the session query is
 * invalidated so the now-cleared flag releases the member into the app. A member who isn't gated (never
 * required, or already enrolled) is bounced straight home so this page is never a dead end.
 */
export function TwoFactorSetupGatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const totp = useTotpSetup();

  const gated = session.data?.twoFactorSetupRequired === true;

  // Auto-open the setup flow ONCE the moment we know the member is gated, so 2FA is the first and only
  // thing in front of them (AC-04). The ran-once ref is deliberate: if the member dismisses the dialog
  // we must NOT silently re-open it with a freshly minted secret (that would churn a QR they may be
  // mid-scan on) — they re-open it themselves via the "Set up 2FA" button below.
  const autoBegunRef = useRef(false);
  useEffect(() => {
    if (gated && !autoBegunRef.current && totp.step === null && !totp.isStarting) {
      autoBegunRef.current = true;
      totp.begin();
    }
  }, [gated, totp]);

  if (session.isPending) return null;
  if (!gated) return <Navigate to="/" replace />;

  function handleDone() {
    // Enrolment cleared the server-side requirement; refresh the session so the guard lets us through.
    void queryClient.invalidateQueries({ queryKey: ['session'] });
    navigate('/', { replace: true });
  }

  return (
    <div className="bg-cl-canvas flex min-h-screen items-center justify-center p-6">
      <div className="border-cl-border bg-cl-surface flex max-w-md flex-col items-center gap-4 rounded-xl border p-8 text-center">
        <div className="bg-cl-accent-weak text-cl-accent flex h-12 w-12 items-center justify-center rounded-full">
          <Icon name="shield" size={24} />
        </div>
        <Text as="h1" size="heading">
          Set up two-factor authentication
        </Text>
        <Text as="p" tone="muted">
          Your organization requires two-factor authentication. Set it up now to continue — you
          won't be able to access Clearline until it's configured.
        </Text>
        <Button variant="primary" onClick={totp.begin} loading={totp.isStarting}>
          Set up 2FA
        </Button>
      </div>
      <TotpSetupDialog controller={totp} onDone={handleDone} />
    </div>
  );
}
