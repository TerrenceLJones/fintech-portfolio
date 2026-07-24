import type { OnboardingTaskId } from '@clearline/contracts';

/**
 * The durable read-model behind the getting-started launcher (EPIC-CW-023 / US-CW-047): which
 * getting-started task events have fired for each user, and whether that user's signature milestone
 * celebration has already been shown. Completion is recorded here at the point the underlying domain
 * action succeeds (an expense submitted, a card issued, a teammate invited, …) — it is never a
 * client-owned "done" toggle (AC-02) — so the launcher is a read model over real activity and can
 * never claim work the system didn't see. A task the user already satisfied simply reads as complete
 * on first render, with no back-fill logic (AC-05).
 *
 * Keyed by userId. In this demo every seed user shares one organization, so per-user is per-user-per-
 * org; a real backend would key the composite. Mirrors OnboardingService's Map + snapshot/restore
 * shape so PersistedOnboardingTasksService can persist it exactly like the KYB onboarding state.
 */
interface OnboardingTasksRecord {
  completed: OnboardingTaskId[];
  milestoneShown: boolean;
}

/** Plain-object mirror of the internal Map, safe to JSON.stringify for sessionStorage persistence. */
export interface OnboardingTasksSnapshot {
  records: [string, OnboardingTasksRecord][];
}

export class OnboardingTasksService {
  private recordsByUserId = new Map<string, OnboardingTasksRecord>();

  private ensure(userId: string): OnboardingTasksRecord {
    let record = this.recordsByUserId.get(userId);
    if (!record) {
      record = { completed: [], milestoneShown: false };
      this.recordsByUserId.set(userId, record);
    }
    return record;
  }

  /** Record that `userId` performed the action `taskId` names. Idempotent — a repeat is a no-op. */
  markComplete(userId: string, taskId: OnboardingTaskId): void {
    const record = this.ensure(userId);
    if (!record.completed.includes(taskId)) record.completed.push(taskId);
  }

  /** The task ids this user has completed (a fresh array — callers may not mutate internal state). */
  getCompleted(userId: string): OnboardingTaskId[] {
    return [...(this.recordsByUserId.get(userId)?.completed ?? [])];
  }

  /** Whether the once-per-user signature milestone celebration has already been shown (AC-03). */
  isMilestoneShown(userId: string): boolean {
    return this.recordsByUserId.get(userId)?.milestoneShown ?? false;
  }

  /** Latch the signature milestone so it never celebrates a second time, even across reloads. */
  markMilestoneShown(userId: string): void {
    this.ensure(userId).milestoneShown = true;
  }

  /** Clear a single user back to no progress — the dev/demo "reset getting-started" control. */
  reset(userId: string): void {
    this.recordsByUserId.delete(userId);
  }

  snapshot(): OnboardingTasksSnapshot {
    return {
      records: [...this.recordsByUserId.entries()].map(([userId, record]) => [
        userId,
        { completed: [...record.completed], milestoneShown: record.milestoneShown },
      ]),
    };
  }

  restore(snapshot: OnboardingTasksSnapshot): void {
    this.recordsByUserId = new Map(
      snapshot.records.map(([userId, record]) => [
        userId,
        { completed: [...record.completed], milestoneShown: record.milestoneShown },
      ]),
    );
  }
}
