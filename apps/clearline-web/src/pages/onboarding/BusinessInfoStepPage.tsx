import { useNavigate } from 'react-router';
import { Link } from 'react-router';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, AuthLayout, Button, Stepper, Text, TextField } from '@clearline/ui';
import { useSubmitBusinessInfo, useCompleteStep } from '@clearline/data-access-onboarding';
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
    // zodResolver's inferred type is too deep for the checker to instantiate here (TS2589) once the
    // data-access-onboarding barrel pulls in the OCR recognizer's heavy types; assert the resolver's
    // type — it genuinely produces BusinessInfoFormValues — rather than restructure that shared barrel.
  } = useForm<BusinessInfoFormValues>({
    resolver: zodResolver(businessInfoSchema) as Resolver<BusinessInfoFormValues>,
  });

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
          state={errors.legalName ? 'error' : undefined}
          error={errors.legalName?.message}
        />
        <TextField
          label="EIN"
          {...register('ein')}
          state={errors.ein || outcome === 'ein_not_found' ? 'error' : undefined}
          error={errors.ein?.message}
        />
        {outcome === 'ein_not_found' && (
          <div role="alert" className="text-cl-neg -mt-3 text-[12px] font-medium">
            We couldn't verify this EIN. Please check and try again.
          </div>
        )}
        {(submitBusinessInfo.isError || completeStep.isError) && (
          <Alert tone="negative" title="Something went wrong. Please try again." />
        )}
        <TextField
          label="Structure"
          {...register('structure')}
          state={errors.structure ? 'error' : undefined}
          error={errors.structure?.message}
        />
        <TextField
          label="Registered address"
          {...register('addressLine1')}
          state={errors.addressLine1 ? 'error' : undefined}
          error={errors.addressLine1?.message}
        />
        <div className="flex gap-3">
          <TextField
            label="City"
            {...register('city')}
            state={errors.city ? 'error' : undefined}
            error={errors.city?.message}
          />
          <TextField
            label="State"
            {...register('state')}
            state={errors.state ? 'error' : undefined}
            error={errors.state?.message}
          />
          <TextField
            label="Postal code"
            {...register('postalCode')}
            state={errors.postalCode ? 'error' : undefined}
            error={errors.postalCode?.message}
          />
        </div>
        <Button
          type="submit"
          loading={submitBusinessInfo.isPending || completeStep.isPending}
          fullWidth
        >
          Continue
        </Button>
      </form>
    </AuthLayout>
  );
}
