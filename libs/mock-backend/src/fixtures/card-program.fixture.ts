import type { IssuancePolicy, MerchantCategoryOption } from '@clearline/contracts';

/** Card-program limits are USD minor units (cents), matching the card wallet (US-CW-014). */
export const CARD_PROGRAM_CURRENCY = 'USD';

/**
 * The merchant-category catalogue a Controller restricts new cards to (US-CW-038 AC-02). `code` is the
 * stable key stored on a card's allowedMccs and matched by the authorization gate; `mcc` is the numeric
 * ISO 18245 code and `label` the human name — both are searchable, so a category resolves whether the
 * Controller types "office" or "5943". This extends the five US-CW-014 codes with their numeric MCCs
 * plus a few more common categories, so the search has something to filter.
 */
export const CARD_PROGRAM_MERCHANT_CATEGORIES: MerchantCategoryOption[] = [
  { code: 'software', mcc: '5734', label: 'Software & Cloud Services' },
  { code: 'office_supplies', mcc: '5943', label: 'Office Supplies' },
  { code: 'travel', mcc: '4722', label: 'Travel & Airlines' },
  { code: 'meals', mcc: '5812', label: 'Meals & Restaurants' },
  { code: 'advertising', mcc: '7311', label: 'Advertising Services' },
  { code: 'shipping', mcc: '4215', label: 'Shipping & Couriers' },
  { code: 'utilities', mcc: '4900', label: 'Utilities' },
  { code: 'telecom', mcc: '4814', label: 'Telecommunications' },
  { code: 'fuel', mcc: '5541', label: 'Fuel & Service Stations' },
  { code: 'lodging', mcc: '7011', label: 'Hotels & Lodging' },
];

/**
 * The org's card-program defaults before any edit (US-CW-038 AC-01). $2,000 monthly / $500 per
 * transaction, restricted to Software and Office Supplies, requestable by everyone — the values the
 * design's issuance mock shows prefilled. getCardProgramDefaults coalesces to these when an org has
 * saved nothing, so orgs provisioned before this story stay valid.
 */
export const DEFAULT_MONTHLY_LIMIT_MINOR_UNITS = 200_000;
export const DEFAULT_PER_TRANSACTION_LIMIT_MINOR_UNITS = 50_000;
export const DEFAULT_ALLOWED_MCCS: string[] = ['software', 'office_supplies'];
export const DEFAULT_ISSUANCE_POLICY: IssuancePolicy = 'everyone';
