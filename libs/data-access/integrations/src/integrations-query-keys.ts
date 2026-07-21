import type { IntegrationProvider } from '@clearline/contracts';

/** Root key for the org's integrations list; every lifecycle mutation invalidates it (US-CW-039). */
export const INTEGRATIONS_QUERY_KEY = ['integrations'] as const;

/** Per-provider GL-mapping key (AC-02). */
export function glMappingQueryKey(provider: IntegrationProvider) {
  return ['integrations', provider, 'gl-mapping'] as const;
}

/** Per-provider sync-log key (AC-05). */
export function syncLogQueryKey(provider: IntegrationProvider) {
  return ['integrations', provider, 'sync-log'] as const;
}
