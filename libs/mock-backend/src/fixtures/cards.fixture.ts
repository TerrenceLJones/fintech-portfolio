import type { CardStatus, CardholderCandidate, MerchantCategory } from '@clearline/contracts';

/** Every card and transaction amount in the demo is USD minor units (cents). */
export const CARD_CURRENCY = 'USD';

/**
 * A seeded virtual card. `authorizedSpendMinorUnits` is the approved spend this cycle; the remaining
 * limit is always DERIVED from it (monthlyLimit − spend) and never stored (US-CW-014 AC-02). The seed
 * transactions below sum to this figure per card so the derived remaining stays internally consistent.
 */
export interface SeedCard {
  id: string;
  holderId: string;
  holderName: string;
  holderInitials: string;
  last4: string;
  exp: string;
  monthlyLimitMinorUnits: number;
  authorizedSpendMinorUnits: number;
  status: CardStatus;
  allowedMccs: string[];
}

/** A seeded backlog transaction — the history a feed replays on connect (US-CW-014 AC-02). */
export interface SeedCardTransaction {
  id: string;
  cardId: string;
  merchantName: string;
  merchantInitials: string;
  mcc: string;
  mccLabel: string;
  amountMinorUnits: number;
  /** ISO 8601 timestamp. */
  occurredAt: string;
  status: 'approved' | 'declined';
}

/**
 * The merchant-category groups a card can be restricted to. `code` is the stable key the authorization
 * gate matches on; `label` is what the issuance chips and feed rows display (US-CW-014 AC-01/AC-03).
 */
export const SEED_MERCHANT_CATEGORIES: MerchantCategory[] = [
  { code: 'software', label: 'Software' },
  { code: 'office_supplies', label: 'Office Supplies' },
  { code: 'travel', label: 'Travel' },
  { code: 'meals', label: 'Meals' },
  { code: 'advertising', label: 'Advertising' },
];

/** People a Controller can issue a card to on the issuance screen (US-CW-014 AC-01). */
export const SEED_CARDHOLDER_CANDIDATES: CardholderCandidate[] = [
  { id: 'emp_reyes', name: 'Dara Reyes', initials: 'DR', team: 'Design' },
  { id: 'emp_nair', name: 'Priya Nair', initials: 'PN', team: 'Eng' },
  { id: 'emp_park', name: 'Sam Park', initials: 'SP', team: 'Sales' },
  { id: 'emp_chen', name: 'Mei Chen', initials: 'MC', team: 'Marketing' },
  { id: 'emp_alvarez', name: 'Jordan Alvarez', initials: 'JA', team: 'Ops' },
  { id: 'emp_okafor', name: 'Tunde Okafor', initials: 'TO', team: 'Finance' },
];

/**
 * The seeded wallet — "4 active · 1 frozen" (matches the design's wallet subtitle). Card 4021 is the
 * flagship detail-feed card (Dara Reyes, Software/Office-only). Card 7712 is seeded near its ceiling
 * ($50 remaining) so the insufficient-limit decline (AC-04) can be demonstrated on it. Card 5567 is
 * frozen (AC-05). Card 8830 stands in for the security-gated / lost-stolen decline scenario (AC-07),
 * shown active in the wallet but declinable to a generic message on demand.
 */
export const SEED_CARDS: SeedCard[] = [
  {
    id: 'card_4021',
    holderId: 'emp_reyes',
    holderName: 'Dara Reyes — Design',
    holderInitials: 'DR',
    last4: '4021',
    exp: '09/28',
    monthlyLimitMinorUnits: 200_000,
    authorizedSpendMinorUnits: 6_300,
    status: 'active',
    allowedMccs: ['software', 'office_supplies'],
  },
  {
    id: 'card_8830',
    holderId: 'emp_nair',
    holderName: 'Priya Nair — Eng',
    holderInitials: 'PN',
    last4: '8830',
    exp: '09/28',
    monthlyLimitMinorUnits: 500_000,
    authorizedSpendMinorUnits: 88_000,
    status: 'active',
    allowedMccs: ['software', 'office_supplies'],
  },
  {
    id: 'card_5567',
    holderId: 'emp_park',
    holderName: 'Sam Park — Sales',
    holderInitials: 'SP',
    last4: '5567',
    exp: '09/28',
    monthlyLimitMinorUnits: 100_000,
    authorizedSpendMinorUnits: 10_000,
    status: 'frozen',
    allowedMccs: ['office_supplies'],
  },
  {
    id: 'card_3344',
    holderId: 'emp_chen',
    holderName: 'Mei Chen — Marketing',
    holderInitials: 'MC',
    last4: '3344',
    exp: '11/27',
    monthlyLimitMinorUnits: 300_000,
    authorizedSpendMinorUnits: 42_000,
    status: 'active',
    allowedMccs: ['advertising', 'software'],
  },
  {
    id: 'card_7712',
    holderId: 'emp_alvarez',
    holderName: 'Jordan Alvarez — Ops',
    holderInitials: 'JA',
    last4: '7712',
    exp: '02/28',
    monthlyLimitMinorUnits: 250_000,
    authorizedSpendMinorUnits: 245_000,
    status: 'active',
    allowedMccs: ['software', 'office_supplies', 'travel'],
  },
];

/**
 * The backlog each card's feed replays on connect. Amounts per card sum to that card's seeded
 * `authorizedSpendMinorUnits`, so the derived remaining limit is provably consistent with the history.
 */
export const SEED_CARD_TRANSACTIONS: SeedCardTransaction[] = [
  {
    id: 'ctxn_awS',
    cardId: 'card_4021',
    merchantName: 'Amazon Web Services',
    merchantInitials: 'AW',
    mcc: 'software',
    mccLabel: 'Software',
    amountMinorUnits: 4_800,
    occurredAt: '2026-07-13T09:12:00.000Z',
    status: 'approved',
  },
  {
    id: 'ctxn_figma',
    cardId: 'card_4021',
    merchantName: 'Figma Inc.',
    merchantInitials: 'Fi',
    mcc: 'software',
    mccLabel: 'Software',
    amountMinorUnits: 1_500,
    occurredAt: '2026-07-14T16:40:00.000Z',
    status: 'approved',
  },
  {
    id: 'ctxn_slack',
    cardId: 'card_8830',
    merchantName: 'Slack Technologies',
    merchantInitials: 'Sl',
    mcc: 'software',
    mccLabel: 'Software',
    amountMinorUnits: 88_000,
    occurredAt: '2026-07-10T11:05:00.000Z',
    status: 'approved',
  },
  {
    id: 'ctxn_wework',
    cardId: 'card_5567',
    merchantName: 'WeWork',
    merchantInitials: 'We',
    mcc: 'office_supplies',
    mccLabel: 'Office Supplies',
    amountMinorUnits: 10_000,
    occurredAt: '2026-06-26T14:20:00.000Z',
    status: 'approved',
  },
  {
    id: 'ctxn_hubspot',
    cardId: 'card_3344',
    merchantName: 'HubSpot',
    merchantInitials: 'Hu',
    mcc: 'advertising',
    mccLabel: 'Advertising',
    amountMinorUnits: 42_000,
    occurredAt: '2026-07-09T13:30:00.000Z',
    status: 'approved',
  },
  {
    id: 'ctxn_datadog',
    cardId: 'card_7712',
    merchantName: 'Datadog',
    merchantInitials: 'Da',
    mcc: 'software',
    mccLabel: 'Software',
    amountMinorUnits: 245_000,
    occurredAt: '2026-07-08T10:00:00.000Z',
    status: 'approved',
  },
];

/**
 * The scripted "live" authorization the demo streams onto the flagship card (US-CW-014 AC-02): a
 * $150.00 Notion Labs charge in an allowed category, so it approves and moves the derived remaining
 * limit before the viewer's eyes.
 */
export const DEMO_LIVE_CHARGE = {
  merchantName: 'Notion Labs',
  merchantInitials: 'No',
  mcc: 'software',
  mccLabel: 'Software',
  amountMinorUnits: 15_000,
} as const;

/** The scripted out-of-policy merchant used to demo the MCC decline (AC-03) — a restaurant charge. */
export const DEMO_MCC_DECLINE_CHARGE = {
  merchantName: 'Vista Grill',
  merchantInitials: 'Vi',
  mcc: 'restaurants',
  mccLabel: 'Restaurants',
  amountMinorUnits: 6_400,
} as const;

/** The scripted over-limit charge used to demo the insufficient-limit decline (AC-04). */
export const DEMO_LIMIT_DECLINE_CHARGE = {
  merchantName: 'GitHub',
  merchantInitials: 'Gi',
  mcc: 'software',
  mccLabel: 'Software',
  amountMinorUnits: 7_500,
} as const;

/** The scripted charge used to demo the security-gated (lost/stolen) decline → generic message (AC-07). */
export const DEMO_SECURITY_DECLINE_CHARGE = {
  merchantName: 'Best Buy',
  merchantInitials: 'Be',
  mcc: 'office_supplies',
  mccLabel: 'Office Supplies',
  amountMinorUnits: 34_000,
} as const;
