import { useState, type SubmitEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Alert, AuthLayout, AuthNotice, Button, PasswordField, Text } from '@fintech-portfolio/ui';
import {
  ResetPasswordError,
  useResetPassword,
  useValidateResetToken,
} from '@fintech-portfolio/data-access-auth';

const WEAK_PASSWORD_MESSAGE =
  'Password must be at least 10 characters and include an uppercase letter, a lowercase letter, and a number.';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const validation = useValidateResetToken(token);
  const resetPassword = useResetPassword();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mismatchError, setMismatchError] = useState(false);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMismatchError(true);
      return;
    }
    setMismatchError(false);
    resetPassword.mutate(
      { token: token!, password: newPassword },
      {
        onSuccess: () => navigate('/login', { replace: true, state: { passwordChanged: true } }),
      },
    );
  }

  if (validation.isLoading) {
    return (
      <AuthLayout>
        <Text as="p" size="body" tone="muted">
          Checking your link…
        </Text>
      </AuthLayout>
    );
  }

  if (!validation.data?.valid) {
    return (
      <AuthLayout>
        <AuthNotice
          icon="clock"
          tone="warning"
          title="This link has expired"
          description="Reset links are valid for 1 hour. Request a new one to continue."
          primaryAction={{ label: 'Resend link', onClick: () => navigate('/forgot-password') }}
        />
      </AuthLayout>
    );
  }

  const error = resetPassword.error;
  const isWeakPassword = error instanceof ResetPasswordError && error.code === 'weak_password';
  const isOtherError = resetPassword.isError && !isWeakPassword;

  return (
    <AuthLayout>
      <Text as="h1" size="title" tone="default" className="mb-1.5">
        Set a new password
      </Text>
      <Text as="p" size="body" tone="muted" className="mb-6">
        Choose a new password for your account.
      </Text>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <PasswordField
          label="New password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          state={isWeakPassword ? 'error' : undefined}
          error={isWeakPassword ? WEAK_PASSWORD_MESSAGE : undefined}
          required
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          state={mismatchError ? 'error' : undefined}
          error={mismatchError ? 'Passwords do not match' : undefined}
          required
        />

        {isOtherError && (
          <Alert
            tone="warning"
            title="Something went wrong on our end."
            action="Try again"
            onAction={() => resetPassword.mutate({ token: token!, password: newPassword })}
          />
        )}

        <Button type="submit" loading={resetPassword.isPending} fullWidth>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}
