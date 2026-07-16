import { describe, expect, it } from 'vitest';
import { isMccAllowed } from './mcc-policy';

describe('isMccAllowed', () => {
  it('allows a transaction whose MCC is on the card allow-list (AC-01/AC-02)', () => {
    expect(isMccAllowed(['software', 'office_supplies'], 'software')).toBe(true);
  });

  it('declines a transaction whose MCC is not on the allow-list (AC-03)', () => {
    // A card restricted to Software/Office Supplies used at a Restaurant.
    expect(isMccAllowed(['software', 'office_supplies'], 'restaurants')).toBe(false);
  });

  it('treats an empty allow-list as unrestricted (any MCC allowed)', () => {
    expect(isMccAllowed([], 'restaurants')).toBe(true);
  });
});
