import { z } from 'zod';
import { isValidEinFormat, requiresKyc } from '@clearline/domain-onboarding';

export const businessInfoSchema = z.object({
  legalName: z.string().min(1, 'Legal business name is required'),
  ein: z.string().refine(isValidEinFormat, 'Enter a valid EIN (format: XX-XXXXXXX)'),
  structure: z.string().min(1, 'Select a business structure'),
  addressLine1: z.string().min(1, 'Registered address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postalCode: z.string().min(5, 'Postal code is required'),
});

export type BusinessInfoFormValues = z.infer<typeof businessInfoSchema>;

export const ownerSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    ownershipPercent: z.coerce
      .number()
      .min(0, 'Enter a valid percentage')
      .max(100, 'Cannot exceed 100%'),
    dateOfBirth: z.string().optional(),
    ssnItin: z.string().optional(),
  })
  .refine((data) => !requiresKyc(data.ownershipPercent) || !!data.dateOfBirth, {
    message: 'Date of birth is required for owners at or above 25% ownership',
    path: ['dateOfBirth'],
  })
  .refine((data) => !requiresKyc(data.ownershipPercent) || !!data.ssnItin, {
    message: 'SSN/ITIN is required for owners at or above 25% ownership',
    path: ['ssnItin'],
  });

export type OwnerFormValues = z.infer<typeof ownerSchema>;
