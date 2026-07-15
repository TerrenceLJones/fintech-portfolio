import { describe, expect, it } from 'vitest';
import { L2_ROUTING_THRESHOLD_MINOR_UNITS, routeSubmittedStatus } from './expense-routing-policy';

describe('routeSubmittedStatus', () => {
  it('routes an expense over the designated approver limit straight to L2 (AC-04)', () => {
    // $25,000.00 over a $10,000.00 manager limit → Controller (L2).
    expect(routeSubmittedStatus(2_500_000)).toBe('pending_l2');
  });

  it('routes an expense at or under the limit to L1 (boundary at exactly $10,000.00)', () => {
    expect(routeSubmittedStatus(L2_ROUTING_THRESHOLD_MINOR_UNITS)).toBe('pending_l1');
    expect(routeSubmittedStatus(30_000)).toBe('pending_l1');
  });
});
