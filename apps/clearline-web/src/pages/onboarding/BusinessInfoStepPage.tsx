import { useNavigate } from 'react-router';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthLayout, Button, Stepper, Text, TextField } from '@fintech-portfolio/ui';
import { useSubmitBusinessInfo, useCompleteStep } from '@fintech-portfolio/data-access-onboarding';
import { businessInfoSchema, type BusinessInfoFormValues } from './schemas';
import { WIZARD_STEP_LABELS } from './wizard-steps';

export function BusinessInfoStepPage() {
  const navigate = useNavigate();
  const submitBusinessInfo = useSubmitBusinessInfo();
  const completeStep = useCompleteStep();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BusinessInfoFormValues>({ resolver: zodResolver(businessInfoSchema) });

  function onSubmit(values: BusinessInfoFormValues) {
    submitBusinessInfo.mutate(values, {
      onSuccess: (result) => {
        if (result.outcome === 'verified') {
          completeStep.mutate('business', {
            onSuccess: () => navigate('/onboarding/owners'),
          });
        }
      },
    });
  }

  const outcome = submitBusinessInfo.data?.outcome;

  if (outcome === 'duplicate_business') {
    return (
      <AuthLayout>
        <Text as="h1" size="title" className="mb-2">
          This business already has an account
        </Text>
        <Text as="p" size="body" tone="muted" className="mb-6">
          It looks like your business already has an account. Sign in instead.
        </Text>
        <Link to="/login" className="text-cl-accent-text text-[13px] font-semibold">
          Sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Stepper steps={WIZARD_STEP_LABELS} current={0} />
      <Text as="h1" size="title" className="mt-5 mb-1.5">
        Tell us about your business
      </Text>
      <Text as="p" size="body" tone="muted" className="mb-6">
        We'll verify these details against public business registries.
      </Text>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <TextField
          label="Legal business name"
          {...register('legalName')}
          error={errors.legalName?.message}
        />
        <TextField label="EIN" {...register('ein')} error={errors.ein?.message} />
        {outcome === 'ein_not_found' && (
          <div role="alert" className="text-cl-neg -mt-3 text-[12px] font-medium">
            We couldn't verify this EIN. Please check and try again.
          </div>
        )}
        <TextField label="Structure" {...register('structure')} error={errors.structure?.message} />
        <TextField
          label="Registered address"
          {...register('addressLine1')}
          error={errors.addressLine1?.message}
        />
        <div className="flex gap-3">
          <TextField label="City" {...register('city')} error={errors.city?.message} />
          <TextField label="State" {...register('state')} error={errors.state?.message} />
          <TextField
            label="Postal code"
            {...register('postalCode')}
            error={errors.postalCode?.message}
          />
        </div>
        <Button type="submit" loading={submitBusinessInfo.isPending} fullWidth>
          Continue
        </Button>
      </form>
    </AuthLayout>
  );
}
