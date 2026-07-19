import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AuthLayout, AuthNotice, Text } from '@clearline/ui';
import { useConfirmEmailChange, useValidateEmailChangeToken } from '@clearline/data-access-profile';
import { usePageTitle } from '../hooks/usePageTitle';

/**
 * The landing page for a personal email-change confirmation link (US-CW-034 AC-03/04). The link is
 * opened from an email and may arrive with no active session, so this lives outside the app shell —
 * like VerifyEmailPage. It validates the token, and on a valid one auto-confirms the swap exactly
 * once; an expired or already-used link shows the "This link has expired" screen with the current
 * email left unchanged.
 */
export function EmailChangeConfirmPage() {
  usePageTitle('Confirm email change');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const validate = useValidateEmailChangeToken(token);
  const confirm = useConfirmEmailChange();

  // Fire the confirm exactly once, and only when the link is valid. The ref guards against React's
  // synchronous double-invoke in StrictMode (where confirm.isIdle would still read true on the second
  // call), and the isIdle check adds defense-in-depth against any later re-render racing a second
  // mutate — together they ensure the single-use token is consumed at most once per mount.
  const attempted = useRef(false);
  useEffect(() => {
    if (validate.data?.valid && confirm.isIdle && !attempted.current) {
      attempted.current = true;
      confirm.mutate(token);
    }
  }, [validate.data?.valid, confirm, token]);

  const expired =
    token.length === 0 ||
    validate.isError ||
    validate.data?.valid === false ||
    confirm.data?.outcome === 'token_expired' ||
    confirm.data?.outcome === 'token_invalid';

  if (expired) {
    return (
      <AuthLayout>
        <AuthNotice
          icon="clock"
          tone="warning"
          title="This link has expired"
          description="Request a new confirmation from your profile settings. Your current email is unchanged."
          primaryAction={{
            label: 'Back to settings',
            onClick: () => navigate('/settings/personal'),
          }}
        />
      </AuthLayout>
    );
  }

  if (confirm.data?.outcome === 'success') {
    return (
      <AuthLayout>
        <AuthNotice
          icon="shield-check"
          tone="positive"
          title="Email updated"
          description={`Your login email is now ${confirm.data.email}. Use it next time you sign in.`}
          primaryAction={{ label: 'Go to settings', onClick: () => navigate('/settings/personal') }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Text as="p" size="body" tone="muted">
        Confirming your new email…
      </Text>
    </AuthLayout>
  );
}
