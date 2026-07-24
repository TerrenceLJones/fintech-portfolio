import { OnboardingTasksService, type OnboardingTasksSnapshot } from './onboarding-tasks.service';

const STORAGE_KEY = 'clearline:mock-onboarding-tasks';

/**
 * Bump whenever OnboardingTasksSnapshot's shape changes so a snapshot written by an older build is
 * discarded rather than restored into an inconsistent state (same rationale as PersistedAuthService).
 */
const SNAPSHOT_VERSION = 1;

interface VersionedSnapshot {
  version: number;
  snapshot: OnboardingTasksSnapshot;
}

/**
 * Same rationale as PersistedOnboardingService: the getting-started read-model lives inside the
 * running JS bundle, so a same-tab reload or a full navigation (following a task deep-link) would
 * otherwise reset a user's progress. Snapshotting to sessionStorage after every mutation and
 * hydrating on construction keeps progress consistent across a reload the way a real backend's
 * database would, while still resetting when the tab closes — and the existing `resetDemoState()`
 * (which clears sessionStorage) wipes it along with the rest of the demo state.
 */
export class PersistedOnboardingTasksService extends OnboardingTasksService {
  constructor() {
    super();
    this.hydrate();
  }

  private hydrate(): void {
    if (typeof sessionStorage === 'undefined') return;
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Partial<VersionedSnapshot>;
      if (parsed.version !== SNAPSHOT_VERSION || !parsed.snapshot) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      this.restore(parsed.snapshot);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  private persist(): void {
    if (typeof sessionStorage === 'undefined') return;
    const payload: VersionedSnapshot = { version: SNAPSHOT_VERSION, snapshot: this.snapshot() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  override markComplete(...args: Parameters<OnboardingTasksService['markComplete']>) {
    super.markComplete(...args);
    this.persist();
  }

  override markMilestoneShown(...args: Parameters<OnboardingTasksService['markMilestoneShown']>) {
    super.markMilestoneShown(...args);
    this.persist();
  }

  override reset(...args: Parameters<OnboardingTasksService['reset']>) {
    super.reset(...args);
    this.persist();
  }
}

/**
 * The one OnboardingTasksService instance every onboarding-tasks handler and event emitter binds to
 * by default — see sharedAuthService's doc comment for why a shared singleton matters. Tests
 * construct their own isolated instance instead.
 */
export const sharedOnboardingTasksService: OnboardingTasksService =
  new PersistedOnboardingTasksService();
