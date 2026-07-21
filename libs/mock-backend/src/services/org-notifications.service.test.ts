import { beforeEach, describe, expect, it } from 'vitest';
import { OrgNotificationsService } from './org-notifications.service';

const ORG = 'org_clearline_demo';

describe('OrgNotificationsService', () => {
  let service: OrgNotificationsService;
  beforeEach(() => {
    service = new OrgNotificationsService();
  });

  it('returns the seeded recipients and reminder cadence', () => {
    const settings = service.getSettings(ORG);
    expect(settings.budgetAlertRecipients.map((r) => r.id)).toEqual(['user_3']);
    expect(settings.approvalReminderFrequency).toBe('every_24_hours');
  });

  it('lists candidate members excluding current recipients (AC-07)', () => {
    const candidates = service.listCandidates(ORG);
    expect(candidates.some((c) => c.id === 'user_3')).toBe(false); // already a recipient
    expect(candidates.some((c) => c.id === 'user_1')).toBe(true); // the Finance Manager
  });

  it('adds a member to the budget-alert list and drops them from candidates (AC-07)', () => {
    const result = service.addRecipient(ORG, 'user_1');
    expect(result.outcome).toBe('ok');
    expect(service.getSettings(ORG).budgetAlertRecipients.some((r) => r.id === 'user_1')).toBe(
      true,
    );
    expect(service.listCandidates(ORG).some((c) => c.id === 'user_1')).toBe(false);
  });

  it('rejects adding a non-member or an existing recipient', () => {
    expect(service.addRecipient(ORG, 'user_ghost').outcome).toBe('unknown_recipient');
    expect(service.addRecipient(ORG, 'user_3').outcome).toBe('already_recipient');
  });

  it('removes a recipient, stopping their alerts (AC-07)', () => {
    const result = service.removeRecipient(ORG, 'user_3');
    expect(result.outcome).toBe('ok');
    expect(service.getSettings(ORG).budgetAlertRecipients).toHaveLength(0);
  });

  it('404-equivalent when removing someone not on the list', () => {
    expect(service.removeRecipient(ORG, 'user_1').outcome).toBe('unknown_recipient');
  });

  it('sets the approval-queue reminder cadence (AC-08)', () => {
    expect(service.setReminderFrequency(ORG, 'every_72_hours').outcome).toBe('ok');
    expect(service.getSettings(ORG).approvalReminderFrequency).toBe('every_72_hours');
  });

  it('rejects an unknown cadence', () => {
    expect(service.setReminderFrequency(ORG, 'hourly' as never).outcome).toBe('invalid_frequency');
  });

  it('scopes state to the org', () => {
    service.addRecipient(ORG, 'user_1');
    expect(service.getSettings('org_other').budgetAlertRecipients).toHaveLength(0);
  });
});
