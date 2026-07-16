import { describe, expect, it } from 'vitest';
import { CARDS_QUERY_KEY, CARDS_ISSUE_CONTEXT_QUERY_KEY, cardQueryKey } from './cards-query-key';

describe('cards query keys', () => {
  it('uses a stable wallet key', () => {
    expect(CARDS_QUERY_KEY).toEqual(['cards']);
  });

  it('uses a distinct issuance-context key', () => {
    expect(CARDS_ISSUE_CONTEXT_QUERY_KEY).toEqual(['cards', 'issue-context']);
  });

  it('parameterises a single card by id', () => {
    expect(cardQueryKey('card_4021')).toEqual(['cards', 'detail', 'card_4021']);
  });
});
