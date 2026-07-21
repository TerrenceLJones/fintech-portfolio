import { beforeEach, describe, expect, it } from 'vitest';
import { IntegrationsService } from './integrations.service';
import { SEED_INTEGRATIONS } from '../fixtures/integrations.fixture';

const ORG = 'org_clearline_demo';
const CLOCK = '2026-07-21T12:00:00.000Z';

function makeService() {
  return new IntegrationsService(SEED_INTEGRATIONS, undefined, () => CLOCK);
}

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  beforeEach(() => {
    service = makeService();
  });

  it('lists every provider in order with its seeded status', () => {
    const list = service.list(ORG);
    expect(list.map((i) => i.provider)).toEqual(['quickbooks', 'xero', 'netsuite']);
    expect(list.find((i) => i.provider === 'quickbooks')?.status).toBe('connected');
    expect(list.find((i) => i.provider === 'xero')?.status).toBe('disconnected');
    expect(list.find((i) => i.provider === 'netsuite')?.status).toBe('error');
  });

  it('scopes state to the org — a different org sees clean defaults', () => {
    const other = service.list('org_other');
    expect(other.every((i) => i.status === 'disconnected')).toBe(true);
  });

  it('connects a disconnected provider via mocked OAuth, landing connected with a just-now sync (AC-01)', () => {
    const result = service.connect(ORG, 'xero');
    expect(result.outcome).toBe('ok');
    const xero = service.list(ORG).find((i) => i.provider === 'xero')!;
    expect(xero.status).toBe('connected');
    expect(xero.accountEmail).toBeDefined();
    expect(xero.lastSyncAt).toBe(CLOCK);
  });

  it('refuses to connect an already-connected provider (concurrent-connect edge case)', () => {
    expect(service.connect(ORG, 'quickbooks').outcome).toBe('already_connected');
  });

  it('exposes the GL mapping with one seeded category unmapped (AC-02)', () => {
    const { mappings, chartOfAccounts } = service.getGlMapping(ORG, 'quickbooks');
    expect(chartOfAccounts.length).toBeGreaterThan(0);
    const equipment = mappings.find((m) => m.categoryId === 'equipment')!;
    expect(equipment.glAccountId).toBeUndefined();
    const travel = mappings.find((m) => m.categoryId === 'travel')!;
    expect(travel.glAccountId).toBe('coa_6000');
  });

  it('updates a GL mapping and can clear a row', () => {
    service.updateGlMapping(ORG, 'quickbooks', [
      { categoryId: 'equipment', glAccountId: 'coa_6300' },
    ]);
    let mapping = service.getGlMapping(ORG, 'quickbooks').mappings;
    expect(mapping.find((m) => m.categoryId === 'equipment')?.glAccountId).toBe('coa_6300');

    service.updateGlMapping(ORG, 'quickbooks', [{ categoryId: 'travel', glAccountId: null }]);
    mapping = service.getGlMapping(ORG, 'quickbooks').mappings;
    expect(mapping.find((m) => m.categoryId === 'travel')?.glAccountId).toBeUndefined();
  });

  it('reports a Partial sync while a category is unmapped, then Success once fully mapped (AC-03/05)', () => {
    const partial = service.syncNow(ORG, 'quickbooks');
    expect(partial.outcome === 'ok' && partial.result.outcome).toBe('partial');

    service.updateGlMapping(ORG, 'quickbooks', [
      { categoryId: 'equipment', glAccountId: 'coa_6300' },
    ]);
    const clean = service.syncNow(ORG, 'quickbooks');
    expect(clean.outcome === 'ok' && clean.result.outcome).toBe('success');
    expect(clean.outcome === 'ok' && clean.result.recordsSynced).toBe(47);
  });

  it('records every sync run in the log, newest first (AC-05)', () => {
    service.syncNow(ORG, 'quickbooks');
    const log = service.getSyncLog(ORG, 'quickbooks');
    expect(log.length).toBeGreaterThanOrEqual(2); // seeded run + this run
    expect(log[0]!.timestamp).toBe(CLOCK);
  });

  it('cannot sync a disconnected provider', () => {
    expect(service.syncNow(ORG, 'xero').outcome).toBe('not_connected');
  });

  it('reconnects a provider from an error state (AC-04)', () => {
    const result = service.reconnect(ORG, 'netsuite');
    expect(result.outcome).toBe('ok');
    expect(service.list(ORG).find((i) => i.provider === 'netsuite')?.status).toBe('connected');
  });

  it('disconnects a provider but preserves its GL mapping for reconnect (AC-06)', () => {
    service.disconnect(ORG, 'quickbooks');
    expect(service.list(ORG).find((i) => i.provider === 'quickbooks')?.status).toBe('disconnected');
    // Reconnect and confirm the mapping survived.
    service.connect(ORG, 'quickbooks');
    const travel = service
      .getGlMapping(ORG, 'quickbooks')
      .mappings.find((m) => m.categoryId === 'travel');
    expect(travel?.glAccountId).toBe('coa_6000');
  });

  it('forces an error state for the demo reconnect flow (AC-04)', () => {
    service.forceSyncError(ORG, 'quickbooks');
    expect(service.list(ORG).find((i) => i.provider === 'quickbooks')?.status).toBe('error');
  });
});
