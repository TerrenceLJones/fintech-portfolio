import type {
  OrgNotificationRecipient,
  OrgNotificationSettings,
  OrgReminderFrequency,
} from '@clearline/contracts';
import {
  ORG_REMINDER_FREQUENCIES,
  SEED_APPROVAL_REMINDER_FREQUENCY,
  SEED_BUDGET_ALERT_RECIPIENT_IDS,
  SEED_ORG_MEMBERS,
  type SeedOrgMember,
} from '../fixtures/org-notifications.fixture';

interface OrgState {
  recipientIds: Set<string>;
  frequency: OrgReminderFrequency;
}

export type AddRecipientOutcome =
  | { outcome: 'ok'; recipient: OrgNotificationRecipient }
  | { outcome: 'unknown_recipient' }
  | { outcome: 'already_recipient' };

export type RemoveRecipientOutcome =
  { outcome: 'ok'; recipient: OrgNotificationRecipient } | { outcome: 'unknown_recipient' };

export type SetFrequencyOutcome = { outcome: 'ok' } | { outcome: 'invalid_frequency' };

/**
 * In-memory organization-notification routing backend for US-CW-039. Each org has a budget-alert
 * recipient list and an approval-queue reminder cadence, mutated immediately (no unsaved-changes
 * footer). Recipients are drawn from a seeded org member pool (AC-07); adding a non-member or an
 * existing recipient is rejected rather than silently accepted. State is per-instance: the app binds
 * the shared singleton; tests construct isolated instances with their own seed.
 */
export class OrgNotificationsService {
  private readonly members: SeedOrgMember[];
  private readonly orgs = new Map<string, OrgState>();

  constructor(
    members: readonly SeedOrgMember[] = SEED_ORG_MEMBERS,
    seedRecipientIds: readonly string[] = SEED_BUDGET_ALERT_RECIPIENT_IDS,
    seedFrequency: OrgReminderFrequency = SEED_APPROVAL_REMINDER_FREQUENCY,
  ) {
    this.members = [...members];
    // Seed each org that has members with its recipient list + cadence.
    const orgIds = new Set(this.members.map((m) => m.orgId));
    for (const orgId of orgIds) {
      const recipientIds = new Set(
        seedRecipientIds.filter((id) => this.memberIn(orgId, id) !== undefined),
      );
      this.orgs.set(orgId, { recipientIds, frequency: seedFrequency });
    }
  }

  /** The org's current routing — budget-alert recipients (resolved to people) and the reminder cadence. */
  getSettings(orgId: string): OrgNotificationSettings {
    const state = this.stateFor(orgId);
    return {
      budgetAlertRecipients: [...state.recipientIds]
        .map((id) => this.toRecipient(orgId, id))
        .filter((r): r is OrgNotificationRecipient => r !== undefined),
      approvalReminderFrequency: state.frequency,
    };
  }

  /** Org members not already on the budget-alert list — the picker's options (AC-07). */
  listCandidates(orgId: string): OrgNotificationRecipient[] {
    const state = this.stateFor(orgId);
    return this.members
      .filter((m) => m.orgId === orgId && !state.recipientIds.has(m.id))
      .map((m) => ({ id: m.id, name: m.name, email: m.email }));
  }

  /** Add a member to the budget-alert recipient list (AC-07). */
  addRecipient(orgId: string, recipientId: string): AddRecipientOutcome {
    const member = this.memberIn(orgId, recipientId);
    if (!member) return { outcome: 'unknown_recipient' };
    const state = this.stateFor(orgId);
    if (state.recipientIds.has(recipientId)) return { outcome: 'already_recipient' };
    state.recipientIds.add(recipientId);
    return { outcome: 'ok', recipient: { id: member.id, name: member.name, email: member.email } };
  }

  /** Remove a member from the budget-alert recipient list, stopping their alerts (AC-07). */
  removeRecipient(orgId: string, recipientId: string): RemoveRecipientOutcome {
    const state = this.stateFor(orgId);
    if (!state.recipientIds.has(recipientId)) return { outcome: 'unknown_recipient' };
    state.recipientIds.delete(recipientId);
    const member = this.memberIn(orgId, recipientId);
    return {
      outcome: 'ok',
      recipient: member
        ? { id: member.id, name: member.name, email: member.email }
        : { id: recipientId, name: recipientId, email: '' },
    };
  }

  /** Set the approval-queue reminder cadence (AC-08). */
  setReminderFrequency(orgId: string, frequency: OrgReminderFrequency): SetFrequencyOutcome {
    if (!ORG_REMINDER_FREQUENCIES.includes(frequency)) return { outcome: 'invalid_frequency' };
    this.stateFor(orgId).frequency = frequency;
    return { outcome: 'ok' };
  }

  private stateFor(orgId: string): OrgState {
    let state = this.orgs.get(orgId);
    if (!state) {
      state = { recipientIds: new Set(), frequency: 'off' };
      this.orgs.set(orgId, state);
    }
    return state;
  }

  private memberIn(orgId: string, id: string): SeedOrgMember | undefined {
    return this.members.find((m) => m.orgId === orgId && m.id === id);
  }

  private toRecipient(orgId: string, id: string): OrgNotificationRecipient | undefined {
    const member = this.memberIn(orgId, id);
    return member ? { id: member.id, name: member.name, email: member.email } : undefined;
  }
}
