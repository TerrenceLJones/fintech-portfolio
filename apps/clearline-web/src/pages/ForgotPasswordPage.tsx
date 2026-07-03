import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router';
import { Alert, AuthLayout, AuthNotice, Button, Text, TextField } from '@fintech-portfolio/ui';
import { useRequestPasswordReset } from '@fintech-portfolio/data-access-auth';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const requestReset = useRequestPasswordReset();

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    requestReset.mutate({ email }, { onSuccess: () => setSubmitted(true) });
  }

  if (submitted) {
    return (
      <AuthLayout>
        <AuthNotice
          icon="mail"
          title="Check your email"
          description="If that email is registered, we've sent a reset link. It's valid for 1 hour."
          secondaryAction={{ label: 'Back to sign in', onClick: () => navigate('/login') }}
        />
        <Text as="div" size="label" tone="faint" className="mt-3.5 text-center">
          Didn't get it?{' '}
          <Button
            variant="link"
            loading={requestReset.isPending}
            onClick={() => requestReset.mutate({ email })}
          >
            Resend
          </Button>
        </Text>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Text as="h1" size="title" tone="default" className="mb-1.5">
        Reset your password
      </Text>
      <Text as="p" size="body" tone="muted" className="mb-6">
        Enter your work email and we'll send a link to reset it.
      </Text>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Work email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />

        {requestReset.isError && (
          <Alert
            tone="warning"
            title="Something went wrong on our end."
            action="Try again"
            onAction={() => requestReset.mutate({ email })}
          />
        )}

        <Button type="submit" loading={requestReset.isPending} fullWidth>
          Send reset link
        </Button>
      </form>

      <div className="mt-4.5 text-center">
        <Button variant="link" onClick={() => navigate('/login')}>
          ← Back to sign in
        </Button>
      </div>
    </AuthLayout>
  );
}
