import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BeneficialOwner } from '@fintech-portfolio/contracts';
import { AuthLayout, Avatar, Button, Stepper, Text, TextField } from '@fintech-portfolio/ui';
import { useAddOwner, useCompleteStep } from '@fintech-portfolio/data-access-onboarding';
import { ownerSchema, type OwnerFormValues } from './schemas';
import { WIZARD_STEP_LABELS } from './wizard-steps';

function initials(fullName: string): string {
  return fullName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function BeneficialOwnersStepPage() {
  const navigate = useNavigate();
  const addOwner = useAddOwner();
  const completeStep = useCompleteStep();
  const [owners, setOwners] = useState<BeneficialOwner[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OwnerFormValues>({ resolver: zodResolver(ownerSchema) });

  function onSubmit(values: OwnerFormValues) {
    addOwner.mutate(values, {
      onSuccess: (result) => {
        setOwners((prev) => [...prev, result.owner]);
        reset();
      },
    });
  }

  function handleContinue() {
    completeStep.mutate('owners', { onSuccess: () => navigate('/onboarding/documents') });
  }

  return (
    <AuthLayout>
      <Stepper steps={WIZARD_STEP_LABELS} current={1} />
      <Text as="h1" size="title" className="mt-5 mb-1.5">
        Beneficial owners
      </Text>
      <Text as="p" size="body" tone="muted" className="mb-6">
        Add anyone who owns 25% or more of the business.
      </Text>

      <div className="mb-5 flex flex-col gap-3">
        {owners.map((owner) => (
          <div
            key={owner.id}
            className="border-cl-border flex items-center gap-3 rounded-lg border p-3"
          >
            <Avatar initials={initials(owner.fullName)} />
            <div className="flex-1">
              <Text as="div" size="label" weight="semibold">
                {owner.fullName}
              </Text>
              <Text as="div" size="mono" tone="faint">
                {owner.ownershipPercent}% ownership
              </Text>
            </div>
            {owner.requiresKyc && (
              <Text as="span" size="label" tone="warning">
                ID verification required
              </Text>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mb-5">
        <TextField label="Owner name" {...register('fullName')} error={errors.fullName?.message} />
        <TextField
          label="Ownership percent"
          {...register('ownershipPercent')}
          error={errors.ownershipPercent?.message}
        />
        <TextField
          label="Date of birth"
          {...register('dateOfBirth')}
          error={errors.dateOfBirth?.message}
        />
        <TextField label="SSN / ITIN" {...register('ssnItin')} error={errors.ssnItin?.message} />
        <Button type="submit" variant="secondary" loading={addOwner.isPending} fullWidth>
          + Add owner
        </Button>
      </form>

      <div className="flex justify-end">
        <Button
          onClick={handleContinue}
          disabled={owners.length === 0}
          loading={completeStep.isPending}
        >
          Continue
        </Button>
      </div>
    </AuthLayout>
  );
}
