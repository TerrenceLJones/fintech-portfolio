import { describe, expect, it } from 'vitest';
import { OnboardingTasksService } from './onboarding-tasks.service';

describe('OnboardingTasksService', () => {
  it('records a task as complete for a user and reads it back (US-CW-047 AC-01)', () => {
    const service = new OnboardingTasksService();
    service.markComplete('user_1', 'submit-expense');
    expect(service.getCompleted('user_1')).toEqual(['submit-expense']);
  });

  it('is idempotent — the same action performed twice does not duplicate the record (AC edge)', () => {
    const service = new OnboardingTasksService();
    service.markComplete('user_1', 'issue-card');
    service.markComplete('user_1', 'issue-card');
    expect(service.getCompleted('user_1')).toEqual(['issue-card']);
  });

  it('keeps each user’s completion separate (per-user read model)', () => {
    const service = new OnboardingTasksService();
    service.markComplete('user_1', 'submit-expense');
    service.markComplete('user_2', 'clear-approval');
    expect(service.getCompleted('user_1')).toEqual(['submit-expense']);
    expect(service.getCompleted('user_2')).toEqual(['clear-approval']);
  });

  it('returns an empty list for a user with no recorded activity (AC-05 pre-existing / first render)', () => {
    const service = new OnboardingTasksService();
    expect(service.getCompleted('nobody')).toEqual([]);
    expect(service.isMilestoneShown('nobody')).toBe(false);
  });

  it('guards the signature milestone to once per user (US-CW-047 AC-03)', () => {
    const service = new OnboardingTasksService();
    expect(service.isMilestoneShown('user_1')).toBe(false);
    service.markMilestoneShown('user_1');
    expect(service.isMilestoneShown('user_1')).toBe(true);
    // A different user is unaffected.
    expect(service.isMilestoneShown('user_2')).toBe(false);
  });

  it('resets a single user back to no progress (beacon reset control)', () => {
    const service = new OnboardingTasksService();
    service.markComplete('user_1', 'submit-expense');
    service.markMilestoneShown('user_1');
    service.reset('user_1');
    expect(service.getCompleted('user_1')).toEqual([]);
    expect(service.isMilestoneShown('user_1')).toBe(false);
  });

  it('round-trips through snapshot/restore without sharing references (persistence)', () => {
    const service = new OnboardingTasksService();
    service.markComplete('user_1', 'submit-expense');
    service.markMilestoneShown('user_1');

    const restored = new OnboardingTasksService();
    restored.restore(service.snapshot());
    expect(restored.getCompleted('user_1')).toEqual(['submit-expense']);
    expect(restored.isMilestoneShown('user_1')).toBe(true);

    // Mutating the restored copy must not leak back into the original.
    restored.markComplete('user_1', 'see-cards');
    expect(service.getCompleted('user_1')).toEqual(['submit-expense']);
  });
});
