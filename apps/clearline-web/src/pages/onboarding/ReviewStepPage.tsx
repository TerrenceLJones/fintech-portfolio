import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useOnboardingStatus, useSubmitReview } from '@fintech-portfolio/data-access-onboarding';
import { AuthLayout, Button, Checkbox, Stepper, Text } from '@fintech-portfolio/ui';
import { WIZARD_STEP_LABELS } from './wizard-steps';

export function ReviewStepPage() {
  const navigate = useNavigate();
  const status = useOnboardingStatus();
  const submitReview = useSubmitReview();
  const [certified, setCertified] = useState(false);

  function handleSubmit() {
    submitReview.mutate(undefined, { onSuccess: () => navigate('/onboarding/status') });
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
