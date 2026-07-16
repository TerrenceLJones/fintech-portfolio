import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { IssueCardContextResponse } from '@clearline/contracts';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { useIssueCardContext } from './use-issue-card-context';
import { CardsForbiddenError } from './use-cards';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

const contextBody: IssueCardContextResponse = {
  candidates: [{ id: 'emp_reyes', name: 'Dara Reyes', initials: 'DR', team: 'Design' }],
  merchantCategories: [
    { code: 'software', label: 'Software' },
    { code: 'office_supplies', label: 'Office Supplies' },
  ],
};

describe('useIssueCardContext', () => {
  it('returns candidates and merchant categories', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/cards/context', () => HttpResponse.json(contextBody)));

    const { result } = renderHook(() => useIssueCardContext(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.candidates[0]?.name).toBe('Dara Reyes');
    expect(result.current.data?.merchantCategories).toHaveLength(2);
  });

  it('surfaces a 403 (a non-Controller reaching the form) as CardsForbiddenError', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/cards/context', () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 }),
      ),
    );

    const { result } = renderHook(() => useIssueCardContext(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(CardsForbiddenError);
  });
});
