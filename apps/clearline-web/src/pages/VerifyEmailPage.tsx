import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AuthLayout, AuthNotice, Text } from '@clearline/ui';
import { setAccessToken, useVerifyEmail } from '@clearline/data-access-auth';
import { usePageTitle } from '../hooks/usePageTitle';

export function VerifyEmailPage() {
  usePageTitle('Verify email');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const verify = useVerifyEmail(token);

  useEffect(() => {
    if (verify.data) {
      setAccessToken(verify.data.accessToken);
      // Land on the app root; the onboarding route guard (US-CW-004 AC-09) funnels a not-yet-
      // onboarded account straight into the KYB wizard, which is what realizes US-CW-029 AC-03's
      // "redirected into business onboarding". LoginPage's redirectTo defaults to the same root.
      navigate('/', { replace: true });
    }
  }, [verify.data, navigate]);

  if (token == null || token.length === 0 || verify.isError) {
    return (
      <AuthLayout>
        <AuthNotice
          icon="clock"
          tone="warning"
          title="This link has expired"
          description="Verification links are valid for 24 hours. Request a new one to continue."
          primaryAction={{ label: 'Resend link', onClick: () => navigate('/signup') }}
        />
      </AuthLayout>
    );
  }

  if (verify.data) {
    return (
      <AuthLayout>
        <AuthNotice
          icon="shield-check"
          tone="positive"
          title="You're verified"
          description="Your email is confirmed and you're signed in. Taking you to business onboarding…"
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Text as="p" size="body" tone="muted">
        Verifying your email…
      </Text>
    </AuthLayout>
  );
}
