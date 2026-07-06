import type {
  BeneficialOwner,
  BeneficialOwnerInput,
  BusinessInfo,
  DocumentType,
  OnboardingOverallStatus,
  OnboardingStatusResponse,
  OnboardingStepId,
  SubmitBusinessInfoOutcome,
  SubmitDocumentOutcome,
  SubmitReviewOutcome,
  UploadedDocument,
} from '@fintech-portfolio/contracts';
import {
  hasOnboardingSessionTimedOut,
  isDocumentVerificationBlocked,
  isValidEinFormat,
  requiresKyc,
} from '@fintech-portfolio/domain-onboarding';
import { REGISTRY_EINS, WATCHLIST_NAMES } from '../fixtures/onboarding.fixture';

const STEP_ORDER: OnboardingStepId[] = ['business', 'owners', 'documents', 'review'];

function nextStep(step: OnboardingStepId): OnboardingStepId {
  const index = STEP_ORDER.indexOf(step);
  return STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)]!;
}

interface OnboardingRecord {
  businessId: string;
  userId: string;
  status: OnboardingOverallStatus;
  currentStep: OnboardingStepId;
  lastCompletedStep: OnboardingStepId | null;
  business: BusinessInfo | null;
  owners: BeneficialOwner[];
  documents: UploadedDocument[];
  documentAttemptCount: number;
  supportReferenceId?: string;
  lastActivityAt: number;
}

export interface SubmitBusinessInfoResult {
  outcome: SubmitBusinessInfoOutcome;
}

export interface AddOwnerResult {
  owner: BeneficialOwner;
}

export interface SubmitDocumentResult {
  outcome: SubmitDocumentOutcome;
  attemptCount: number;
  supportReferenceId?: string;
}

export interface SubmitReviewResult {
  outcome: SubmitReviewOutcome;
}

/** Plain-object mirror of OnboardingService's internal Map, safe to JSON.stringify. */
export interface OnboardingServiceSnapshot {
  records: [string, OnboardingRecord][];
}

/**
 * Document-type classification can't be real computer vision in a mock backend, so it's a
 * deterministic filename heuristic — the same "mocked lookup" approach REGISTRY_EINS takes for
 * business-registry verification. Test/e2e fixtures name files accordingly (e.g.
 * 'drivers-license-front.jpg'); anything else is treated as an unrecognized document type.
 */
function classifyDocumentType(fileName: string): DocumentType {
  const lower = fileName.toLowerCase();
  if (lower.includes('drivers-license') || lower.includes('drivers_license'))
    return 'drivers_license';
  if (lower.includes('passport')) return 'passport';
  if (lower.includes('state-id') || lower.includes('state_id')) return 'state_id';
  return 'unrecognized';
}

export class OnboardingService {
  private readonly recordsByUserId = new Map<string, OnboardingRecord>();
  /** Tracks which EIN each *created* onboarding record belongs to, for duplicate-account detection (US-CW-004 AC-07). */
  private readonly userIdByEin = new Map<string, string>();

  getStatus(userId: string, now: number = Date.now()): OnboardingStatusResponse {
    const record = this.getOrCreateRecord(userId, now);

    let sessionTimedOut = false;
    if (
      record.currentStep !== record.lastCompletedStep &&
      hasOnboardingSessionTimedOut(record.lastActivityAt, now)
    ) {
      record.currentStep = record.lastCompletedStep ?? 'business';
      record.lastActivityAt = now;
      sessionTimedOut = true;
    }

    return {
      businessId: record.businessId,
      status: record.status,
      currentStep: record.currentStep,
      lastCompletedStep: record.lastCompletedStep,
      business: record.business,
      owners: [...record.owners],
      documents: [...record.documents],
      documentAttemptCount: record.documentAttemptCount,
      supportReferenceId: record.supportReferenceId,
      lastActivityAt: record.lastActivityAt,
      sessionTimedOut,
    };
  }

  /** Bumps lastActivityAt without changing any other state — called on every real user interaction so the 30-minute idle window resets. */
  recordActivity(userId: string, now: number = Date.now()): void {
    const record = this.getOrCreateRecord(userId, now);
    record.lastActivityAt = now;
  }

  async submitBusinessInfo(
    userId: string,
    business: BusinessInfo,
    now: number = Date.now(),
  ): Promise<SubmitBusinessInfoResult> {
    const record = this.getOrCreateRecord(userId, now);

    if (!isValidEinFormat(business.ein) || !REGISTRY_EINS.has(business.ein)) {
      return { outcome: 'ein_not_found' };
    }

    const existingOwner = this.userIdByEin.get(business.ein);
    if (existingOwner && existingOwner !== userId) {
      return { outcome: 'duplicate_business' };
    }

    record.business = business;
    record.lastCompletedStep = 'business';
    record.currentStep = nextStep('business');
    record.lastActivityAt = now;
    this.userIdByEin.set(business.ein, userId);

    return { outcome: 'verified' };
  }

  async addOwner(
    userId: string,
    input: BeneficialOwnerInput,
    now: number = Date.now(),
  ): Promise<AddOwnerResult> {
    const record = this.getOrCreateRecord(userId, now);

    const owner: BeneficialOwner = {
      id: `owner_${crypto.randomUUID()}`,
      fullName: input.fullName,
      ownershipPercent: input.ownershipPercent,
      requiresKyc: requiresKyc(input.ownershipPercent),
      dateOfBirth: input.dateOfBirth,
      ssnItinLast4: input.ssnItin?.slice(-4),
    };
    record.owners.push(owner);
    record.lastActivityAt = now;

    return { owner };
  }

  /** Marks `step` complete and advances currentStep to the next step in wizard order — the "Continue" button's server-side effect. */
  completeStep(userId: string, step: OnboardingStepId, now: number = Date.now()): void {
    const record = this.getOrCreateRecord(userId, now);
    record.lastCompletedStep = step;
    record.currentStep = nextStep(step);
    record.lastActivityAt = now;
  }

  submitDocument(
    userId: string,
    document: { ownerId: string; fileName: string; mimeType: string },
    now: number = Date.now(),
  ): SubmitDocumentResult {
    const record = this.getOrCreateRecord(userId, now);
    record.lastActivityAt = now;

    if (isDocumentVerificationBlocked(record.documentAttemptCount)) {
      return {
        outcome: 'blocked',
        attemptCount: record.documentAttemptCount,
        supportReferenceId: record.supportReferenceId,
      };
    }

    const documentType = classifyDocumentType(document.fileName);
    if (documentType === 'unrecognized') {
      record.documentAttemptCount += 1;

      if (isDocumentVerificationBlocked(record.documentAttemptCount)) {
        record.status = 'documents_blocked';
        record.supportReferenceId = `SR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        return {
          outcome: 'blocked',
          attemptCount: record.documentAttemptCount,
          supportReferenceId: record.supportReferenceId,
        };
      }

      return { outcome: 'wrong_type', attemptCount: record.documentAttemptCount };
    }

    record.documents = [
      ...record.documents.filter((existing) => existing.ownerId !== document.ownerId),
      { ownerId: document.ownerId, documentType },
    ];

    return { outcome: 'accepted', attemptCount: record.documentAttemptCount };
  }

  submitReview(userId: string, now: number = Date.now()): SubmitReviewResult {
    const record = this.getOrCreateRecord(userId, now);
    record.lastActivityAt = now;

    const namesToScreen = [
      record.business?.legalName,
      ...record.owners.map((owner) => owner.fullName),
    ]
      .filter((name): name is string => !!name)
      .map((name) => name.toLowerCase());

    const matchesWatchlist = WATCHLIST_NAMES.some((watched) =>
      namesToScreen.some((name) => name.includes(watched)),
    );

    record.status = matchesWatchlist ? 'under_review' : 'approved';
    return { outcome: matchesWatchlist ? 'under_review' : 'approved' };
  }

  snapshot(): OnboardingServiceSnapshot {
    return {
      records: [...this.recordsByUserId].map(([userId, record]) => [userId, { ...record }]),
    };
  }

  restore(snapshot: OnboardingServiceSnapshot): void {
    this.recordsByUserId.clear();
    this.userIdByEin.clear();
    snapshot.records.forEach(([userId, record]) => {
      this.recordsByUserId.set(userId, record);
      if (record.business) this.userIdByEin.set(record.business.ein, userId);
    });
  }

  private getOrCreateRecord(userId: string, now: number): OnboardingRecord {
    const existing = this.recordsByUserId.get(userId);
    if (existing) return existing;

    const record: OnboardingRecord = {
      businessId: `business_${crypto.randomUUID()}`,
      userId,
      status: 'in_progress',
      currentStep: 'business',
      lastCompletedStep: null,
      business: null,
      owners: [],
      documents: [],
      documentAttemptCount: 0,
      lastActivityAt: now,
    };
    this.recordsByUserId.set(userId, record);
    return record;
  }
}
