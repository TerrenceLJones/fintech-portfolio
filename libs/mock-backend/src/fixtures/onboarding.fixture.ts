import type { BusinessInfo } from '@clearline/contracts';
import { SEED_USERS } from './users.fixture';

/**
 * EINs the mock business registry recognizes as real, registrable businesses — anything else
 * fails EIN verification (US-CW-004 AC-04). Real registry integration is out of scope for this
 * mock backend, same as SEED_USERS stands in for a real user directory.
 */
export const REGISTRY_EINS = new Set<string>(['12-3456789', '98-7654321', '11-2223334']);

/**
 * The demo seed user is an established, already-onboarded business, so signing in as it lands on
 * the dashboard rather than the KYB wizard (US-CW-004 AC-09/AC-10) — new-user onboarding is
 * exercised with freshly signed-up accounts instead. Its EIN is a REGISTRY_EIN deliberately not
 * used by any onboarding test (which use 12-3456789 / 98-7654321), so claiming it for duplicate
 * detection can't collide with those flows.
 */
export const DEMO_ONBOARDED_USER_ID = SEED_USERS[0]!.id;

export const DEMO_ONBOARDED_BUSINESS: BusinessInfo = {
  legalName: 'Clearline Demo Co',
  ein: '11-2223334',
  structure: 'C-Corporation',
  addressLine1: '1 Market St',
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94105',
};

/**
 * Legal names (case-insensitive substring match) that trigger the mock watchlist/compliance
 * screening outcome. Never exposed to the client — only the neutral 'under_review' status
 * crosses the API boundary (US-CW-005 AC-05).
 */
export const WATCHLIST_NAMES = ['vostok trading', 'northgate holdings'];
