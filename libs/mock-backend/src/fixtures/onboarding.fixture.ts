/**
 * EINs the mock business registry recognizes as real, registrable businesses — anything else
 * fails EIN verification (US-CW-004 AC-04). Real registry integration is out of scope for this
 * mock backend, same as SEED_USERS stands in for a real user directory.
 */
export const REGISTRY_EINS = new Set<string>(['12-3456789', '98-7654321', '11-2223334']);

/**
 * Legal names (case-insensitive substring match) that trigger the mock watchlist/compliance
 * screening outcome. Never exposed to the client — only the neutral 'under_review' status
 * crosses the API boundary (US-CW-005 AC-05).
 */
export const WATCHLIST_NAMES = ['vostok trading', 'northgate holdings'];
