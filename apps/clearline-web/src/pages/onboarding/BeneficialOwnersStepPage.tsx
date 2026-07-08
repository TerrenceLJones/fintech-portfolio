import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BeneficialOwner } from '@clearline/contracts';
import { Alert, AuthLayout, Avatar, Button, Stepper, Text, TextField } from '@clearline/ui';
import { useAddOwner, useCompleteStep } from '@clearline/data-access-onboarding';
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
    // zodResolver's inferred type is too deep for the checker to instantiate here (TS2589) once the
    // data-access-onboarding barrel pulls in the OCR recognizer's heavy types; assert the resolver's
    // type — it genuinely produces OwnerFormValues — rather than restructure that shared barrel.
  } = useForm<OwnerFormValues>({
    resolver: zodResolver(ownerSchema) as Resolver<OwnerFormValues>,
  });

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
        <div className="flex gap-3">
          <TextField
            label="First name"
            {...register('firstName')}
            state={errors.firstName ? 'error' : undefined}
            error={errors.firstName?.message}
          />
          <TextField
            label="Last name"
            {...register('lastName')}
            state={errors.lastName ? 'error' : undefined}
            error={errors.lastName?.message}
          />
        </div>
        <TextField
          label="Ownership percent"
          {...register('ownershipPercent')}
          state={errors.ownershipPercent ? 'error' : undefined}
          error={errors.ownershipPercent?.message}
        />
        <TextField
          label="Date of birth"
          {...register('dateOfBirth')}
          state={errors.dateOfBirth ? 'error' : undefined}
          error={errors.dateOfBirth?.message}
        />
        <TextField
          label="SSN / ITIN"
          {...register('ssnItin')}
          state={errors.ssnItin ? 'error' : undefined}
          error={errors.ssnItin?.message}
        />
        {addOwner.isError && (
          <Alert tone="negative" title="Something went wrong. Please try again." />
        )}
        <Button type="submit" variant="secondary" loading={addOwner.isPending} fullWidth>
          + Add owner
        </Button>
      </form>
      {completeStep.isError && (
        <Alert tone="negative" title="Something went wrong. Please try again." />
      )}

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
