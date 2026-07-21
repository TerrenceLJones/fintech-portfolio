import type { IntegrationProvider } from '@clearline/contracts';

/**
 * The presentational facts about each accounting provider the client and mock backend both need — the
 * human display name and the two/three-character badge initials shown in the IntegrationCard glyph
 * (design §19.8). Kept in the domain layer (not the UI) so the seed data and the card render the same
 * name, and so a new provider is added in exactly one place.
 */
export interface IntegrationProviderInfo {
  provider: IntegrationProvider;
  name: string;
  /** Monospace badge initials in the card's provider glyph, e.g. "QB". */
  initials: string;
}

export const INTEGRATION_CATALOGUE: Record<IntegrationProvider, IntegrationProviderInfo> = {
  quickbooks: { provider: 'quickbooks', name: 'QuickBooks Online', initials: 'QB' },
  xero: { provider: 'xero', name: 'Xero', initials: 'X' },
  netsuite: { provider: 'netsuite', name: 'NetSuite', initials: 'NS' },
};

/** Render order for the IntegrationCard grid — stable so the page never reflows between loads. */
export const INTEGRATION_PROVIDER_ORDER: IntegrationProvider[] = ['quickbooks', 'xero', 'netsuite'];

/** Whether a string is a known provider — the server's guard before touching an integration. */
export function isIntegrationProvider(value: string): value is IntegrationProvider {
  return value === 'quickbooks' || value === 'xero' || value === 'netsuite';
}

/** The display name for a provider, e.g. "QuickBooks Online" — the audit label and card title. */
export function integrationProviderName(provider: IntegrationProvider): string {
  return INTEGRATION_CATALOGUE[provider].name;
}
