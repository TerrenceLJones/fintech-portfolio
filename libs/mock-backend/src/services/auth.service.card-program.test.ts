import { describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';
import { buildSeedUser } from '../fixtures/test-factories';
import { SEED_ORGANIZATION } from '../fixtures/users.fixture';
import {
  DEFAULT_ISSUANCE_POLICY,
  DEFAULT_MONTHLY_LIMIT_MINOR_UNITS,
  DEFAULT_PER_TRANSACTION_LIMIT_MINOR_UNITS,
} from '../fixtures/card-program.fixture';

const ORG_ID = SEED_ORGANIZATION.id;

async function makeService() {
  const user = await buildSeedUser({
    id: 'user_owner',
    email: 'owner@clearline.dev',
    role: 'controller',
    isOwner: true,
    orgId: ORG_ID,
  });
  return new AuthService([user]);
}

describe('getCardProgramDefaults (US-CW-038 AC-01)', () => {
  it('coalesces to the seed defaults when the org has saved nothing', async () => {
    const service = await makeService();
    const defaults = service.getCardProgramDefaults(ORG_ID);
    expect(defaults).not.toBeNull();
    expect(defaults!.defaultMonthlyLimitMinorUnits).toBe(DEFAULT_MONTHLY_LIMIT_MINOR_UNITS);
    expect(defaults!.defaultPerTransactionLimitMinorUnits).toBe(
      DEFAULT_PER_TRANSACTION_LIMIT_MINOR_UNITS,
    );
    expect(defaults!.issuancePolicy).toBe(DEFAULT_ISSUANCE_POLICY);
  });

  it('returns null for an unknown org', async () => {
    const service = await makeService();
    expect(service.getCardProgramDefaults('org_missing')).toBeNull();
  });
});

describe('setCardProgramDefaults (US-CW-038 AC-01/02/03)', () => {
  it('persists new defaults and reads them back', async () => {
    const service = await makeService();
    const saved = service.setCardProgramDefaults(ORG_ID, {
      defaultMonthlyLimitMinorUnits: 300_000,
      defaultPerTransactionLimitMinorUnits: 75_000,
      defaultAllowedMccs: ['software', 'travel'],
      issuancePolicy: 'managers_and_above',
    });
    expect(saved!.defaultMonthlyLimitMinorUnits).toBe(300_000);

    const reread = service.getCardProgramDefaults(ORG_ID);
    expect(reread!.defaultAllowedMccs).toEqual(['software', 'travel']);
    expect(reread!.issuancePolicy).toBe('managers_and_above');
  });

  it('returns null for an unknown org', async () => {
    const service = await makeService();
    expect(
      service.setCardProgramDefaults('org_missing', {
        defaultMonthlyLimitMinorUnits: 1,
        defaultPerTransactionLimitMinorUnits: 1,
        defaultAllowedMccs: [],
        issuancePolicy: 'everyone',
      }),
    ).toBeNull();
  });
});
