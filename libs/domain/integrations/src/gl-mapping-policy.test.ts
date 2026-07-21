import { describe, expect, it } from 'vitest';
import type { GlMappingEntry } from '@clearline/contracts';
import {
  isFullyMapped,
  syncOutcomeForMapping,
  unmappedCategoryCount,
  unmappedEntries,
} from './gl-mapping-policy';

const mapped = (id: string): GlMappingEntry => ({
  categoryId: id,
  categoryLabel: id,
  glAccountId: `gl_${id}`,
});
const unmapped = (id: string): GlMappingEntry => ({ categoryId: id, categoryLabel: id });

describe('gl-mapping-policy', () => {
  it('reports the unmapped entries and count', () => {
    const mappings = [mapped('travel'), unmapped('meals'), unmapped('software')];
    expect(unmappedEntries(mappings).map((e) => e.categoryId)).toEqual(['meals', 'software']);
    expect(unmappedCategoryCount(mappings)).toBe(2);
  });

  it('treats a fully-mapped non-empty set as fully mapped', () => {
    expect(isFullyMapped([mapped('travel'), mapped('meals')])).toBe(true);
    expect(isFullyMapped([mapped('travel'), unmapped('meals')])).toBe(false);
  });

  it('treats an empty set as not fully mapped', () => {
    expect(isFullyMapped([])).toBe(false);
  });

  it('derives success only when every category is mapped, else partial', () => {
    expect(syncOutcomeForMapping([mapped('travel'), mapped('meals')])).toBe('success');
    expect(syncOutcomeForMapping([mapped('travel'), unmapped('meals')])).toBe('partial');
  });
});
