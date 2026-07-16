import { useQuery } from '@tanstack/react-query';
import type { IssueCardContextResponse } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { CARDS_ISSUE_CONTEXT_QUERY_KEY } from './cards-query-key';
// The wallet read and the issuance-context read share one forbidden error, exported from use-cards.
import { CardsForbiddenError } from './use-cards';

async function getIssueContext(): Promise<IssueCardContextResponse> {
  const response = await authenticatedFetch('/api/cards/context');
  if (response.status === 403) throw new CardsForbiddenError();
  if (!response.ok) throw new Error('cards_context_failed');
  return response.json();
}

/** The issuance form's context: who a card can be issued to and the selectable MCC groups (US-CW-014 AC-01). */
export function useIssueCardContext(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: CARDS_ISSUE_CONTEXT_QUERY_KEY,
    queryFn: getIssueContext,
    retry: false,
    enabled: options.enabled,
  });
}
