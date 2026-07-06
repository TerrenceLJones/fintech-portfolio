import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  useOnboardingStatus,
  useSubmitDocument,
  useCompleteStep,
} from '@fintech-portfolio/data-access-onboarding';
import {
  AuthLayout,
  Button,
  DocumentDropzone,
  Stepper,
  Text,
  type DocumentDropzoneStatus,
} from '@fintech-portfolio/ui';
import { WIZARD_STEP_LABELS } from './wizard-steps';

export function DocumentUploadStepPage() {
  const navigate = useNavigate();
  const status = useOnboardingStatus();
  const submitDocument = useSubmitDocument();
  const completeStep = useCompleteStep();
  const [documentStatusByOwnerId, setDocumentStatusByOwnerId] = useState<
    Record<string, DocumentDropzoneStatus>
  >({});

  const kycOwners = status.data?.owners.filter((owner) => owner.requiresKyc) ?? [];
  // Vacuously true when no owner requires KYC — nothing to upload, so Continue isn't blocked.
  // Gated on status.data being loaded so Continue isn't enabled before there's anything to check.
  const allAccepted =
    status.data != null &&
    kycOwners.every((owner) => documentStatusByOwnerId[owner.id] === 'accepted');

  function handleFileSelected(ownerId: string, file: File) {
    setDocumentStatusByOwnerId((prev) => ({ ...prev, [ownerId]: 'checking' }));
    submitDocument.mutate(
      { file, ownerId },
      {
        onSuccess: ({ outcome }) => {
          if (outcome === 'blocked') {
            navigate('/onboarding/status');
            return;
          }
          setDocumentStatusByOwnerId((prev) => ({ ...prev, [ownerId]: outcome }));
        },
      },
    );
  }

  function handleContinue() {
    completeStep.mutate('documents', { onSuccess: () => navigate('/onboarding/review') });
  }

  return (
    <AuthLayout>
      <Stepper steps={WIZARD_STEP_LABELS} current={2} />
      <Text as="h1" size="title" className="mt-5 mb-1.5">
        Upload identity documents
      </Text>
      <Text as="p" size="body" tone="muted" className="mb-6">
        A government-issued photo ID for each owner being verified.
      </Text>

      <div className="mb-5 flex flex-col gap-4">
        {kycOwners.map((owner) => (
          <DocumentDropzone
            key={owner.id}
            label={`${owner.fullName} — Driver's license`}
            status={documentStatusByOwnerId[owner.id] ?? 'idle'}
            onFileSelected={(file) => handleFileSelected(owner.id, file)}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleContinue} disabled={!allAccepted} loading={completeStep.isPending}>
          Continue
        </Button>
      </div>
    </AuthLayout>
  );
}
