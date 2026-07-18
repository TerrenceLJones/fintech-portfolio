export type OnboardingStepId = 'business' | 'owners' | 'documents' | 'review';

/**
 * 'duplicate_business' is deliberately NOT a member here — it's a one-shot rejection of a new
 * onboarding *attempt* against an EIN someone else already onboarded (US-CW-004 AC-07), never a
 * persisted status of this user's own record, so it only ever appears as
 * SubmitBusinessInfoOutcome, not here.
 */
export type OnboardingOverallStatus =
  'in_progress' | 'under_review' | 'approved' | 'documents_blocked';

export interface BusinessInfo {
  legalName: string;
  ein: string;
  structure: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface BeneficialOwnerInput {
  firstName: string;
  lastName: string;
  ownershipPercent: number;
  dateOfBirth?: string;
  /** Full value, only ever sent once on submission — never echoed back by the server. See BeneficialOwner.ssnItinLast4. */
  ssnItin?: string;
}

export interface BeneficialOwner {
  id: string;
  firstName: string;
  lastName: string;
  /** Server-derived from `${firstName} ${lastName}` — the combined value display and screening code read. */
  fullName: string;
  ownershipPercent: number;
  requiresKyc: boolean;
  dateOfBirth?: string;
  ssnItinLast4?: string;
}

export type DocumentType = 'drivers_license' | 'passport' | 'state_id' | 'unrecognized';

export interface UploadedDocument {
  ownerId: string;
  documentType: DocumentType;
}

export interface OnboardingStatusResponse {
  businessId: string;
  status: OnboardingOverallStatus;
  currentStep: OnboardingStepId;
  lastCompletedStep: OnboardingStepId | null;
  business: BusinessInfo | null;
  owners: BeneficialOwner[];
  documents: UploadedDocument[];
  documentAttemptCount: number;
  supportReferenceId?: string;
  lastActivityAt: number;
  /** True only on the call that detected a 30-minute idle gap and rolled currentStep back to lastCompletedStep (US-CW-004 AC-06). */
  sessionTimedOut: boolean;
}

export type SubmitBusinessInfoRequest = BusinessInfo;

/**
 * 'duplicate_business' and 'duplicate_business_not_owner' both reject a new onboarding attempt against
 * an EIN someone else already onboarded (US-CW-004 AC-07/AC-08), branching on who is attempting it.
 * The owner re-attempting their own account sees "Sign in instead" (AC-07); a different person at the
 * same business — who has no Clearline credentials of their own — is told to ask their admin for an
 * invite instead, with no sign-in CTA (AC-08). Neither is ever a persisted status of the user's own
 * record, so both appear only here as a one-shot outcome, never in OnboardingOverallStatus.
 */
export type SubmitBusinessInfoOutcome =
  'verified' | 'ein_not_found' | 'duplicate_business' | 'duplicate_business_not_owner';

export interface SubmitBusinessInfoResponse {
  outcome: SubmitBusinessInfoOutcome;
}

export type AddOwnerRequest = BeneficialOwnerInput;

export interface AddOwnerResponse {
  owner: BeneficialOwner;
}

export interface SubmitDocumentRequest {
  ownerId: string;
  /**
   * Text extracted client-side (browser OCR) from the captured document. The server classifies the
   * document type by matching keywords in this text — the raw image bytes never leave the browser.
   */
  ocrText: string;
  mimeType: string;
}

export type SubmitDocumentOutcome = 'accepted' | 'wrong_type' | 'blocked';

export interface SubmitDocumentResponse {
  outcome: SubmitDocumentOutcome;
  attemptCount: number;
  supportReferenceId?: string;
}

export type SubmitReviewOutcome = 'approved' | 'under_review';

export interface SubmitReviewResponse {
  outcome: SubmitReviewOutcome;
}

export type CompleteStepResponse = Record<string, never>;

export type OnboardingErrorCode = 'unauthenticated';

export interface OnboardingErrorResponse {
  error: OnboardingErrorCode;
}
