import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AuthLayout, AuthNotice, Text } from '@fintech-portfolio/ui';
import { setAccessToken, useVerifyEmail } from '@fintech-portfolio/data-access-auth';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const verify = useVerifyEmail(token);

  useEffect(() => {
    if (verify.data) {
      setAccessToken(verify.data.accessToken);
      // /onboarding (US-CW-004) doesn't exist yet — land on the dashboard in the meantime, same
      // stand-in LoginPage's redirectTo already defaults to.
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
