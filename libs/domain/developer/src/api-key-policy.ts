/**
 * API-key rules backing Developer settings (US-CW-041 AC-01/02/03). Pure — no randomness, no storage —
 * so the same masking and scope checks drive the mock backend's server-side enforcement and any client
 * pre-flight. Key generation itself is NOT here: minting a real secret needs entropy and belongs to the
 * (impure) mock service; the domain only ever handles a key that already exists.
 */
import type { ApiKeyScope, ApiKeyScopeOption } from '@clearline/contracts';

/** The live-mode key prefix all issued keys and their masked forms carry. */
export const API_KEY_MASK_PREFIX = 'sk_live_';

/** How many bullets stand in for the redacted middle of a masked key (design §19.3). */
const MASK_BULLETS = 14;

/**
 * The masked display form of a key (AC-01/02): the `sk_live_` prefix, a fixed run of bullets, and the
 * last four real characters so an admin can tell two keys apart — never any other character of the
 * secret. Used everywhere the key is shown after its one-time reveal.
 */
export function maskApiKey(fullKey: string): string {
  const lastFour = fullKey.slice(-4);
  return `${API_KEY_MASK_PREFIX}${'•'.repeat(MASK_BULLETS)}${lastFour}`;
}

/** Whether a key holding `granted` scopes may perform an operation requiring `required` (AC-03). */
export function hasScope(granted: readonly ApiKeyScope[], required: ApiKeyScope): boolean {
  return granted.includes(required);
}

/** The scopes a key can be granted, with the copy the create form renders (AC-01). Least-privilege. */
export const API_KEY_SCOPES: readonly ApiKeyScopeOption[] = [
  {
    scope: 'read:transactions',
    label: 'Read transactions',
    description: 'View transaction and payment history.',
  },
  { scope: 'read:cards', label: 'Read cards', description: 'View cards and their spend controls.' },
  {
    scope: 'read:expenses',
    label: 'Read expenses',
    description: 'View submitted expenses and their status.',
  },
  {
    scope: 'write:transfers',
    label: 'Initiate transfers',
    description: 'Create and submit payments and transfers.',
  },
  {
    scope: 'write:cards',
    label: 'Manage cards',
    description: 'Issue cards and change card controls.',
  },
];
