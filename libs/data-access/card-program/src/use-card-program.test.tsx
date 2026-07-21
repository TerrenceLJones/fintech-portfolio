import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { CardProgramDefaultsResponse } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import { useCardProgram, useUpdateCardProgram } from './use-card-program';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const DEFAULTS: CardProgramDefaultsResponse = {
  defaultMonthlyLimit: { amountMinorUnits: 200_000, currency: 'USD' },
  defaultPerTransactionLimit: { amountMinorUnits: 50_000, currency: 'USD' },
  defaultAllowedMccs: ['software', 'office_supplies'],
  issuancePolicy: 'everyone',
  merchantCategories: [{ code: 'software', mcc: '5734', label: 'Software & Cloud Services' }],
  currency: 'USD',
};

describe('useCardProgram / useUpdateCardProgram (AC-01/02/03)', () => {
  it('loads the defaults then persists an edit into the cache', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/card-program', () => HttpResponse.json(DEFAULTS)),
      http.patch('*/api/card-program', () =>
        HttpResponse.json({ ...DEFAULTS, issuancePolicy: 'managers_and_above' }),
      ),
    );
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(
      () => ({ program: useCardProgram(), update: useUpdateCardProgram() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.program.isSuccess).toBe(true));
    expect(result.current.program.data?.issuancePolicy).toBe('everyone');

    result.current.update.mutate({
      defaultMonthlyLimitMinorUnits: 200_000,
      defaultPerTransactionLimitMinorUnits: 50_000,
      defaultAllowedMccs: ['software'],
      issuancePolicy: 'managers_and_above',
    });
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(result.current.program.data?.issuancePolicy).toBe('managers_and_above');
  });
});
