import type { GlMappingEntry, SyncOutcome } from '@clearline/contracts';

/** The entries with no GL account assigned — the "Not mapped" rows the UI flags amber (AC-02). */
export function unmappedEntries(mappings: readonly GlMappingEntry[]): GlMappingEntry[] {
  return mappings.filter((entry) => !entry.glAccountId);
}

/** How many categories are still unmapped — drives the amber "N not mapped" summary (AC-02/05). */
export function unmappedCategoryCount(mappings: readonly GlMappingEntry[]): number {
  return unmappedEntries(mappings).length;
}

/** Whether every category is mapped — a fully-mapped set is the precondition for a clean sync (AC-05). */
export function isFullyMapped(mappings: readonly GlMappingEntry[]): boolean {
  return mappings.length > 0 && unmappedCategoryCount(mappings) === 0;
}

/**
 * The outcome a sync run would carry given the current mapping (AC-03/05): a fully-mapped set syncs
 * cleanly (`success`); any unmapped category downgrades the run to `partial`, since those categories'
 * transactions can't be posted to a GL account. `failed` is reserved for a provider/auth error, which
 * is decided by the connection state, not the mapping.
 */
export function syncOutcomeForMapping(mappings: readonly GlMappingEntry[]): SyncOutcome {
  return isFullyMapped(mappings) ? 'success' : 'partial';
}
