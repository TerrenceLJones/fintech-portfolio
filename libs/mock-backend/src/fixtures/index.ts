// Pure seed-data barrel — safe to import from either the browser or Node MSW setup, and from app
// dev tooling (e.g. the demo guide) that needs to display the seeded data to testers. Contains no
// handler/worker wiring, so importing it never pulls in msw/browser or msw/node.
export { SEED_USERS, DEMO_USER_PASSWORD } from './users.fixture';
export type { SeedUser } from './users.fixture';
export {
  SEED_SOURCE_ACCOUNT,
  SEED_RECIPIENTS,
  SEED_INTENTS,
  SEED_FX_RATES,
} from './payments.fixture';
export type { SeedRecipient } from './payments.fixture';
export { SEED_APPROVALS } from './approvals.fixture';
export {
  REGISTRY_EINS,
  WATCHLIST_NAMES,
  DEMO_ONBOARDED_USER_ID,
  DEMO_ONBOARDED_BUSINESS,
} from './onboarding.fixture';
