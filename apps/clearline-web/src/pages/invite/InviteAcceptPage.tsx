import { useState, type SubmitEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Alert,
  AuthLayout,
  AuthNotice,
  Button,
  PasswordField,
  PasswordRequirementsList,
  Text,
} from '@clearline/ui';
import { evaluateSignUpPassword, isValidSignUpPassword } from '@clearline/domain-auth';
import { useAcceptInvite, useInviteDetails } from '@clearline/data-access-team';
import { roleLabel } from '../../rbac/identity';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { inviteAcceptBeacon } from './InviteAcceptPage.beacon';
import { usePageTitle } from '../../hooks/usePageTitle';

const EXPIRED_MESSAGE = 'This invite has expired. Ask an admin to resend it.';

/**
 * Public invite-acceptance page (US-CW-031 AC-02/AC-03 / Design §18.3). A brand-new invitee sets a
 * password and is dropped straight onto their role dashboard — never business onboarding, which the
 * Owner already completed for the whole organization. Expired or invalid links grant no membership.
 */
export function InviteAcceptPage() {
  usePageTitle('Accept invite');
  useDemoBeacon(inviteAcceptBeacon);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const details = useInviteDetails(token);
  const acceptInvite = useAcceptInvite();

  const [password, setPassword] = useState('');
  const requirements = evaluateSignUpPassword(password);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!token || !isValidSignUpPassword(password)) return;
    acceptInvite.mutate(
      { token, password },
      {
        onSuccess: (result) => {
          // Auto-logged-in by the hook (the access token is stored) — land on the role dashboard.
          if (result.outcome === 'success') navigate('/', { replace: true });
        },
      },
    );
  }

  if (details.isLoading) {
    return (
      <AuthLayout>
        <Text as="p" size="body" tone="muted">
          Checking your invite…
        </Text>
      </AuthLayout>
    );
  }

  // Expired (or invalid) link — no membership granted (AC-03). Same treatment as expired verification
  // / reset links. An accept attempt that races to expiry surfaces the same outcome.
  const expiredByAccept =
    acceptInvite.data?.outcome === 'invite_expired' ||
    acceptInvite.data?.outcome === 'invite_invalid';
  if (details.data?.status !== 'valid' || expiredByAccept) {
    const invalid = details.data?.status === 'invalid';
    return (
      <AuthLayout>
        <AuthNotice
          icon="clock"
          tone="warning"
          title={invalid ? 'This invite isn’t valid' : 'This invite has expired'}
          description={
            invalid
              ? 'No membership was granted. Ask an admin to send a new invite.'
              : EXPIRED_MESSAGE
          }
          secondaryAction={{ label: 'Go to sign in', onClick: () => navigate('/login') }}
        />
      </AuthLayout>
    );
  }

  const { inviterName, organizationName, role, email } = details.data;
  const isWeakPassword = acceptInvite.data?.outcome === 'weak_password';
  const isOtherError = acceptInvite.isError;

  return (
    <AuthLayout>
      <Alert
        tone="info"
        title={`${inviterName} invited you to ${organizationName}`}
        message={role ? `You'll join as ${roleLabel(role)}.` : undefined}
      />
      <Text as="h1" size="title" tone="default" className="mt-4 mb-1.5">
        Set a password to join
      </Text>
      {email ? (
        <Text as="p" size="body" tone="muted" className="mb-6">
          {email}
        </Text>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <PasswordField
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            state={isWeakPassword ? 'error' : undefined}
            error={isWeakPassword ? 'Choose a stronger password to continue.' : undefined}
            required
          />
          <div className="mt-2">
            <PasswordRequirementsList
              items={[
                { label: 'At least 12 characters', met: requirements.minLength },
                { label: 'Upper & lowercase', met: requirements.hasUpperAndLower },
                { label: 'A number', met: requirements.hasNumber },
                { label: 'A symbol', met: requirements.hasSymbol },
              ]}
            />
          </div>
        </div>

        {isOtherError && (
          <Alert
            tone="warning"
            title="Something went wrong on our end."
            action="Try again"
            onAction={() => token && acceptInvite.mutate({ token, password })}
          />
        )}

        <Button
          type="submit"
          loading={acceptInvite.isPending}
          disabled={!isValidSignUpPassword(password)}
          fullWidth
        >
          Set password &amp; continue
        </Button>
        <Text as="p" size="label" tone="faint" className="text-center">
          Straight to your dashboard — no onboarding.
        </Text>
      </form>
    </AuthLayout>
  );
}
