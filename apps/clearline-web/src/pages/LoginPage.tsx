import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  Alert,
  AuthLayout,
  Button,
  Modal,
  PasswordField,
  Text,
  TextField,
} from '@fintech-portfolio/ui';
import {
  LoginError,
  setAccessToken,
  useLogin,
  useLogout,
  useSignUp,
  type SessionEndedReason,
} from '@fintech-portfolio/data-access-auth';
import { usePageTitle } from '../hooks/usePageTitle';

// Only redirect to a same-origin path carried in `next` — anything else (an absolute URL, or a
// `//host` protocol-relative one) could send a just-authenticated user off Clearline entirely.
function resolveRedirectTarget(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return next;
  }
  return '/';
}

// Extends the canonical SessionEndedReason (api-client.ts) with 'inactivity', the one reason that
// never comes from the interceptor — same union SessionActivityBoundary builds, kept independent
// since this only reads the location.state shape it (and RequireAuth) write, same as the existing
// passwordChanged flag's convention. Tying it to SessionEndedReason means a new reason added
// upstream is a compile error here instead of a silently-blank banner.
type SessionEndReason = SessionEndedReason | 'inactivity';

// Copy stays neutral even for the security-incident case (AC-02) — the reuse detection itself is
// the security response; alarming the user with it here wouldn't help them and reads as an
// accusation. All four read as calm, expected outcomes of an ended session.
const SESSION_END_MESSAGES: Record<SessionEndReason, string> = {
  security: 'For your security, we signed you out. Please sign in again.',
  password_changed: 'Your session ended. Please sign in again.',
  expired: 'Your session expired. Please sign in again.',
  invalid: 'Your session expired. Please sign in again.',
  inactivity: 'You were signed out due to inactivity. Please sign in again.',
};

export function LoginPage() {
  usePageTitle('Sign in');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const redirectTo = resolveRedirectTarget(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const logout = useLogout();
  const resendVerification = useSignUp();
  const passwordChanged = Boolean(
    (location.state as { passwordChanged?: boolean } | null)?.passwordChanged,
  );
  const sessionEndReason = (location.state as { sessionEndReason?: SessionEndReason } | null)
    ?.sessionEndReason;
  // Set only when a login succeeds with hasOtherActiveSession — gates committing this device's
  // session behind the user confirming the concurrent-sign-in notice (AC-07), rather than
  // finalizing it immediately like every other successful login.
  const [pendingAccessToken, setPendingAccessToken] = useState<string | null>(null);
  // Tracks whether an open concurrent-session notice has been explicitly resolved (confirmed or
  // cancelled) — starts true (nothing pending). If this page unmounts while still false, the user
  // abandoned the notice (e.g. browser back) without choosing either option: the session it
  // guards was already established server-side, so it's revoked on the way out rather than left
  // live and un-reconciled indefinitely.
  const pendingResolvedRef = useRef(true);
  const logoutRef = useRef(logout.mutate);

  useEffect(() => {
    logoutRef.current = logout.mutate;
  }, [logout.mutate]);

  useEffect(() => {
    return () => {
      if (!pendingResolvedRef.current) {
        logoutRef.current();
      }
    };
  }, []);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          if (data.hasOtherActiveSession) {
            pendingResolvedRef.current = false;
            setPendingAccessToken(data.accessToken);
            return;
          }
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
  const isUnverified = error instanceof LoginError && error.code === 'unverified_account';
  // isPending and isError are mutually exclusive statuses in TanStack Query, so login.error stays
  // null for the whole retry window and only populates once retries are exhausted — checking
  // isError here would make the mid-retry "Retrying…" copy below unreachable. failureReason is
  // the field that updates on every failed attempt while still pending, so use that while
  // isPending is true and fall back to the settled error once it isn't.
  const networkFailure = login.isPending ? login.failureReason : error;
  const isNetworkError = networkFailure != null && !(networkFailure instanceof LoginError);

  return (
    <AuthLayout>
      <Text as="h1" size="title" tone="default" className="mb-1.5">
        Sign in
      </Text>
      <Text as="p" size="body" tone="muted" className="mb-6">
        Use your work account to continue.
      </Text>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {sessionEndReason && (
          <Alert tone="neutral" title={SESSION_END_MESSAGES[sessionEndReason]} />
        )}

        {passwordChanged && (
          <Alert
            tone="positive"
            title="Your password was changed. Sign in with your new password."
          />
        )}

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
            <Link to="/forgot-password" className="text-cl-accent-text text-[12.5px] font-medium">
              Forgot password?
            </Link>
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

        {isUnverified && (
          <Alert
            tone="warning"
            title={
              resendVerification.isSuccess
                ? 'Verification email sent. Check your inbox.'
                : 'Verify your email to continue. Check your inbox for the link, or request a new one.'
            }
            action={
              resendVerification.isPending || resendVerification.isSuccess
                ? undefined
                : 'Resend verification email'
            }
            onAction={() => resendVerification.mutate({ email, password })}
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
        Don't have an account?{' '}
        <Link to="/signup" className="text-cl-accent-text text-[12.5px] font-medium">
          Sign up
        </Link>
      </Text>

      <Text as="div" size="label" weight="regular" tone="faint" className="mt-2 text-center">
        Trouble signing in?{' '}
        <Text as="span" size="label" tone="accent">
          Contact support
        </Text>
      </Text>

      <Modal
        open={pendingAccessToken != null}
        onOpenChange={(open) => {
          if (open) return;
          // Cancelling doesn't just dismiss the notice — the login that triggered it already
          // established a real session server-side (US-CW-002 AC-07 is explicit that continuing
          // elsewhere never forces the other device out, but says nothing about leaving this one
          // dangling on Cancel), so it's revoked rather than left live with nothing using it.
          pendingResolvedRef.current = true;
          logout.mutate();
          setPendingAccessToken(null);
        }}
        tone="accent"
        icon="shield"
        title="New sign-in detected"
        body="You're signed in on another device. Continue here?"
        cancelLabel="Cancel"
        confirmLabel="Continue here"
        onConfirm={() => {
          if (!pendingAccessToken) return;
          pendingResolvedRef.current = true;
          setAccessToken(pendingAccessToken);
          navigate(redirectTo, { replace: true });
        }}
      />
    </AuthLayout>
  );
}
