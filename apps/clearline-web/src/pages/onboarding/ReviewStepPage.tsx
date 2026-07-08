import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  ONBOARDING_STATUS_QUERY_KEY,
  useOnboardingStatus,
  useSubmitReview,
} from '@clearline/data-access-onboarding';
import { Alert, AuthLayout, Button, Checkbox, Stepper, Text } from '@clearline/ui';
import { WIZARD_STEP_LABELS } from './wizard-steps';

export function ReviewStepPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = useOnboardingStatus();
  const submitReview = useSubmitReview();
  const [certified, setCertified] = useState(false);

  function handleSubmit() {
    submitReview.mutate(undefined, {
      onSuccess: () => {
        // Order matters: leave the guarded wizard route for the status screen BEFORE invalidating,
        // so the freshly-terminal status is refetched while we're already on /onboarding/status
        // (which waits out the in-flight fetch) rather than on this step, where the wizard guard
        // would redirect approved straight to the dashboard and skip the approval screen (AC-08).
        navigate('/onboarding/status');
        queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_QUERY_KEY });
      },
    });
  }

  const business = status.data?.business;
  const owners = status.data?.owners ?? [];

  return (
    <AuthLayout>
      <Stepper steps={WIZARD_STEP_LABELS} current={3} />
      <Text as="h1" size="title" className="mt-5 mb-6">
        Review & submit
      </Text>

      {business ? (
        <div className="border-cl-border mb-4 rounded-lg border p-3">
          <Text as="div" size="mono" tone="faint" className="mb-1 uppercase">
            Business
          </Text>
          <Text as="div" size="body">
            {business.legalName} · EIN {business.ein}
          </Text>
          <Text as="div" size="label" tone="faint">
            {business.addressLine1}, {business.city}, {business.state} {business.postalCode}
          </Text>
        </div>
      ) : null}

      {owners.length > 0 ? (
        <div className="border-cl-border mb-4 rounded-lg border p-3">
          <Text as="div" size="mono" tone="faint" className="mb-1 uppercase">
            Owners
          </Text>
          <Text as="div" size="body">
            {owners.map((owner) => `${owner.fullName} (${owner.ownershipPercent}%)`).join(' · ')}
          </Text>
        </div>
      ) : null}

      <label className="mb-5 flex items-start gap-2">
        <Checkbox
          checked={certified}
          onCheckedChange={setCertified}
          aria-label="Certify accuracy"
        />
        <Text as="span" size="label" tone="muted">
          I certify that the information provided is accurate and that I'm authorized to open this
          account.
        </Text>
      </label>

      {submitReview.isError && (
        <div className="mb-4">
          <Alert tone="negative" title="Something went wrong. Please try again." />
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!certified}
        loading={submitReview.isPending}
        fullWidth
      >
        Submit for verification
      </Button>
    </AuthLayout>
  );
}
