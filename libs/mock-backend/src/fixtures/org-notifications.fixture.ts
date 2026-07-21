import type { OrgNotificationRecipient, OrgReminderFrequency } from '@clearline/contracts';
import { SEED_ORGANIZATION } from './users.fixture';

/** A member who can be routed org-level notifications, scoped to an org (AC-07). */
export interface SeedOrgMember extends OrgNotificationRecipient {
  orgId: string;
}

/**
 * The org member pool the budget-alert recipient picker draws from (AC-07). Mirrors the SEED_USERS
 * roster so "add a Finance Manager" (Marcus Okafor) is exercisable out of the box. Seeded here — a
 * self-contained slice — rather than coupled to the team-roster service, matching how connected-accounts
 * seeds its own data.
 */
export const SEED_ORG_MEMBERS: SeedOrgMember[] = [
  { orgId: SEED_ORGANIZATION.id, id: 'user_1', name: 'Marcus Okafor', email: 'demo@clearline.dev' },
  {
    orgId: SEED_ORGANIZATION.id,
    id: 'user_2',
    name: 'Theo Alvarez',
    email: 'employee@clearline.dev',
  },
  {
    orgId: SEED_ORGANIZATION.id,
    id: 'user_3',
    name: 'Sofia Whitman',
    email: 'controller@clearline.dev',
  },
  {
    orgId: SEED_ORGANIZATION.id,
    id: 'user_owner',
    name: 'Priya Nair',
    email: 'owner@clearline.dev',
  },
];

/** The recipient ids on the org's budget-alert list at seed — one recipient so the × remove is demoable. */
export const SEED_BUDGET_ALERT_RECIPIENT_IDS: string[] = ['user_3'];

/** The org's approval-queue reminder cadence at seed. */
export const SEED_APPROVAL_REMINDER_FREQUENCY: OrgReminderFrequency = 'every_24_hours';

/** The reminder cadences the frequency selector offers (AC-08). */
export const ORG_REMINDER_FREQUENCIES: OrgReminderFrequency[] = [
  'off',
  'every_24_hours',
  'every_72_hours',
];
