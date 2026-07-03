import { useState, type SubmitEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Alert, AuthLayout, Button, PasswordField, Text, TextField } from '@fintech-portfolio/ui';
import { LoginError, setAccessToken, useLogin } from '@fintech-portfolio/data-access-auth';

// Only redirect to a same-origin path carried in `next` — anything else (an absolute URL, or a
// `//host` protocol-relative one) could send a just-authenticated user off Clearline entirely.
function resolveRedirectTarget(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return next;
  }
  return '/';
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = resolveRedirectTarget(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          setAccessToken(data.accessToken);
          navigate(redirectTo, { replace: true });
        },
        onError: (error) => {
          // Only invalid_credentials clears the password field (AC-02/AC-03) — a network error
          // or lockout must NOT clear it, or the "Try again" retry would resubmit an empty
          // password instead of the value the user actually typed.
          if (error instanceof LoginError && error.code === 'invalid_credentials') {
            setPassword('');
          }
        },
      },
    );
  }

  const error = login.error;
  const isLockedOut = error instanceof LoginError && error.code === 'account_locked';
  const isInvalidCredentials = error instanceof LoginError && error.code === 'invalid_credentials';
  const isNetworkError = login.isError && !(error instanceof LoginError);

  return (
    <AuthLayout>
      <Text as="h1" size="title" tone="default" className="mb-1.5">
        Sign in
      </Text>
      <Text as="p" size="body" tone="muted" className="mb-6">
        Use your work account to continue.
      </Text>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isInvalidCredentials && (
          <div role="alert">
            <Alert tone="negative" title="Incorrect email or password" />
          </div>
        )}

        <TextField
          label="Work email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Text as="label" size="label" tone="muted" htmlFor="password">
              Password
            </Text>
            <Text as="span" size="label" tone="accent">
              Forgot password?
            </Text>
          </div>
          <PasswordField
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder={isInvalidCredentials ? 'Enter your password' : undefined}
            required
          />
        </div>

        {isLockedOut && (
          <Alert
            tone="critical"
            title="Your account is temporarily locked for your protection. Contact support to restore access."
            message={
              error instanceof LoginError && error.supportReferenceId
                ? `Reference: ${error.supportReferenceId}`
                : undefined
            }
          />
        )}

        {isNetworkError && (
          <Alert
            tone="warning"
            title={
              login.isPending
                ? 'Something went wrong on our end. Retrying…'
                : 'Something went wrong on our end.'
            }
            action={login.isPending ? undefined : 'Try again'}
            onAction={() => login.mutate({ email, password })}
          />
        )}

        <Button type="submit" loading={login.isPending} fullWidth>
          Sign in
        </Button>
      </form>

      <Text as="div" size="label" weight="regular" tone="faint" className="mt-4.5 text-center">
        Trouble signing in?{' '}
        <Text as="span" size="label" tone="accent">
          Contact support
        </Text>
      </Text>
    </AuthLayout>
  );
}
