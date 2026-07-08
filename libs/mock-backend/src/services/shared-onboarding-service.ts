import { OnboardingService, type OnboardingServiceSnapshot } from './onboarding.service';

const STORAGE_KEY = 'clearline:mock-onboarding-state';

/**
 * Same rationale as PersistedAuthService: survives a same-tab page reload by snapshotting to
 * sessionStorage after every state-changing call. This is NOT what makes US-CW-004 AC-02's
 * cross-device/close-the-browser resume work — that comes from OnboardingService's own
 * in-memory state being the single source of truth, re-fetched via GET /api/onboarding/status on
 * every load, the same way a real backend's database would behave. This class only prevents a
 * dev-server reload (or a full navigation, e.g. following a deep link) from losing progress
 * within the same browser tab/session.
 */
export class PersistedOnboardingService extends OnboardingService {
  constructor() {
    super();
    this.hydrate();
  }

  private hydrate(): void {
    if (typeof sessionStorage === 'undefined') return;
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      this.restore(JSON.parse(saved) as OnboardingServiceSnapshot);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  private persist(): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot()));
  }

  override async submitBusinessInfo(...args: Parameters<OnboardingService['submitBusinessInfo']>) {
    const result = await super.submitBusinessInfo(...args);
    this.persist();
    return result;
  }

  override async addOwner(...args: Parameters<OnboardingService['addOwner']>) {
    const result = await super.addOwner(...args);
    this.persist();
    return result;
  }

  override completeStep(...args: Parameters<OnboardingService['completeStep']>) {
    super.completeStep(...args);
    this.persist();
  }

  override submitDocument(...args: Parameters<OnboardingService['submitDocument']>) {
    const result = super.submitDocument(...args);
    this.persist();
    return result;
  }

  override submitReview(...args: Parameters<OnboardingService['submitReview']>) {
    const result = super.submitReview(...args);
    this.persist();
    return result;
  }
}

/** The one OnboardingService instance every onboarding handler binds to by default — see sharedAuthService's doc comment for why a shared singleton matters. Tests construct their own isolated instance instead. */
export const sharedOnboardingService: OnboardingService = new PersistedOnboardingService();
