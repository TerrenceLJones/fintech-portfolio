import { describe, expect, it } from 'vitest';
import { ConnectedAccountsService } from './connected-accounts.service';
import {
  MICRO_DEPOSIT_AMOUNTS_MINOR_UNITS,
  SEED_CONNECTED_ACCOUNTS,
} from '../fixtures/connected-accounts.fixture';
import { SEED_ORGANIZATION } from '../fixtures/users.fixture';

const ORG = SEED_ORGANIZATION.id;
const OTHER_ORG = 'org_other';

function service() {
  return new ConnectedAccountsService();
}

describe('ConnectedAccountsService', () => {
  it('lists the seeded accounts for their owning org', () => {
    expect(service().list(ORG)).toHaveLength(SEED_CONNECTED_ACCOUNTS.length);
  });

  it('connects a Plaid account already verified (AC-04)', () => {
    const svc = service();
    const account = svc.connectViaPlaid(ORG);
    expect(account.method).toBe('plaid');
    expect(account.status).toBe('connected');
    expect(account.last4).toHaveLength(4);
    expect(svc.list(ORG).some((a) => a.id === account.id)).toBe(true);
  });

  describe('manual connection + micro-deposit verification (AC-05/06)', () => {
    it('starts pending and verifies with the correct amounts', () => {
      const svc = service();
      const connect = svc.connectManually(ORG, '021000021', '1234567890');
      expect(connect.outcome).toBe('ok');
      if (connect.outcome !== 'ok') return;
      expect(connect.account.status).toBe('pending_verification');
      expect(connect.account.last4).toBe('7890');
      expect(connect.account.verificationAttemptsRemaining).toBe(3);

      const verify = svc.verifyMicroDeposits(ORG, connect.account.id, [
        ...MICRO_DEPOSIT_AMOUNTS_MINOR_UNITS,
      ]);
      expect(verify.outcome).toBe('verified');
      if (verify.outcome === 'verified') expect(verify.account.status).toBe('connected');
    });

    it('verifies regardless of the order the two amounts are entered', () => {
      const svc = service();
      const connect = svc.connectManually(ORG, '021000021', '1234567890');
      if (connect.outcome !== 'ok') throw new Error('setup');
      const [a, b] = MICRO_DEPOSIT_AMOUNTS_MINOR_UNITS;
      const verify = svc.verifyMicroDeposits(ORG, connect.account.id, [b, a]);
      expect(verify.outcome).toBe('verified');
    });

    it('rejects a 9-digit-invalid routing number', () => {
      expect(service().connectManually(ORG, '123', '1234567890').outcome).toBe('invalid_routing');
    });

    it('refuses a duplicate of an already-connected account in the same org (same last four)', () => {
      const svc = service();
      // Seed account acct_svb ends in 3355.
      expect(svc.connectManually(ORG, '021000021', '9999993355').outcome).toBe('already_connected');
    });

    it('locks verification after three wrong attempts (AC-06)', () => {
      const svc = service();
      const connect = svc.connectManually(ORG, '021000021', '1234567890');
      if (connect.outcome !== 'ok') throw new Error('setup');
      const id = connect.account.id;

      const first = svc.verifyMicroDeposits(ORG, id, [1, 2]);
      expect(first.outcome).toBe('mismatch');
      if (first.outcome === 'mismatch') expect(first.attemptsRemaining).toBe(2);

      const second = svc.verifyMicroDeposits(ORG, id, [3, 4]);
      expect(second.outcome).toBe('mismatch');
      if (second.outcome === 'mismatch') expect(second.attemptsRemaining).toBe(1);

      const third = svc.verifyMicroDeposits(ORG, id, [5, 6]);
      expect(third.outcome).toBe('locked');

      // A locked account no longer accepts verification.
      expect(svc.verifyMicroDeposits(ORG, id, [...MICRO_DEPOSIT_AMOUNTS_MINOR_UNITS]).outcome).toBe(
        'not_pending',
      );
    });
  });

  it('removes an account so it no longer appears (AC-07)', () => {
    const svc = service();
    const removed = svc.remove(ORG, 'acct_chase');
    expect(removed.outcome).toBe('ok');
    expect(svc.list(ORG).some((a) => a.id === 'acct_chase')).toBe(false);
    expect(svc.remove(ORG, 'acct_chase').outcome).toBe('not_found');
  });

  it('recovers a Plaid account from reconnect_required (AC-08)', () => {
    const svc = service();
    expect(svc.forceReconnectRequired(ORG, 'acct_chase').outcome).toBe('ok');
    expect(svc.list(ORG).find((a) => a.id === 'acct_chase')?.status).toBe('reconnect_required');

    const reconnected = svc.reconnect(ORG, 'acct_chase');
    expect(reconnected.outcome).toBe('ok');
    expect(svc.list(ORG).find((a) => a.id === 'acct_chase')?.status).toBe('connected');
  });

  describe('owning-org isolation', () => {
    it('never lists or mutates another org’s account', () => {
      const svc = service();
      // A different org sees none of the demo org's seeded accounts.
      expect(svc.list(OTHER_ORG)).toHaveLength(0);
      // And can't remove, reconnect, or verify one it doesn't own — treated as not_found.
      expect(svc.remove(OTHER_ORG, 'acct_chase').outcome).toBe('not_found');
      expect(svc.reconnect(OTHER_ORG, 'acct_novo').outcome).toBe('not_found');
      // The demo org's account is untouched.
      expect(svc.list(ORG).some((a) => a.id === 'acct_chase')).toBe(true);
    });
  });
});
