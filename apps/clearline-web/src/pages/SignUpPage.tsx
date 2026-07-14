import { useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Alert,
  AuthLayout,
  AuthNotice,
  Button,
  PasswordField,
  PasswordRequirementsList,
  Text,
  TextField,
} from '@clearline/ui';
import { evaluateSignUpPassword, isValidSignUpPassword } from '@clearline/domain-auth';
import { useSignUp } from '@clearline/data-access-auth';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { usePageTitle } from '../hooks/usePageTitle';
import { signUpBeacon } from './SignUpPage.beacon';

const SIGNUP_HEADLINE = 'Set up your business account in minutes.';
const SIGNUP_SUBCOPY =
  'Verify your email, complete a short onboarding, and start issuing cards and approving spend from an immutable ledger.';

export function SignUpPage() {
  usePageTitle('Sign up');
  useDemoBeacon(signUpBeacon);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const signUp = useSignUp();

  const requirements = evaluateSignUpPassword(password);
  const isPasswordValid = isValidSignUpPassword(password);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!isPasswordValid) return;
    signUp.mutate({ email, password }, { onSuccess: () => setSubmitted(true) });
  }

  if (submitted) {
    return (
      <AuthLayout headline={SIGNUP_HEADLINE} subcopy={SIGNUP_SUBCOPY}>
        <AuthNotice
          icon="mail"
          title="Check your email to verify your account"
          description={`We've sent a verification link to ${email}. The link is valid for 24 hours.`}
          secondaryAction={{ label: 'Back to sign in', onClick: () => navigate('/login') }}
        />
        <Text as="div" size="label" tone="faint" className="mt-3.5 text-center">
          Didn't get it?{' '}
          <Button
            variant="link"
            loading={signUp.isPending}
            onClick={() => signUp.mutate({ email, password })}
          >
            Resend
          </Button>
        </Text>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout headline={SIGNUP_HEADLINE} subcopy={SIGNUP_SUBCOPY}>
      <Text as="h1" size="title" tone="default" className="mb-1.5">
        Create your account
      </Text>
      <Text as="p" size="body" tone="muted" className="mb-6">
        Use your work email to get started.
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

        <div>
          <PasswordField
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
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

        {signUp.isError && (
          <Alert
            tone="warning"
            title="Something went wrong on our end."
            action="Try again"
            onAction={() => signUp.mutate({ email, password })}
          />
        )}

        <Button type="submit" disabled={!isPasswordValid} loading={signUp.isPending} fullWidth>
          Create account
        </Button>
      </form>

      <div className="mt-4.5 text-center">
        <Text as="span" size="label" tone="faint">
          Already have an account?{' '}
        </Text>
        <Link to="/login" className="text-cl-accent-text text-[12.5px] font-medium">
          Log in
        </Link>
      </div>
    </AuthLayout>
  );
}
