import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useValidateResetToken } from './use-validate-reset-token';
import {
  buildValidateResetTokenResponse,
  registerMswServer,
} from '@fintech-portfolio/mock-backend/test-factories';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

describe('useValidateResetToken', () => {
  it('resolves valid: true for a valid token', async () => {
    server.use(
      http.get('*/api/auth/reset-password/validate', () =>
        HttpResponse.json(buildValidateResetTokenResponse()),
      ),
    );

    const { result } = renderHook(() => useValidateResetToken('reset_abc'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(buildValidateResetTokenResponse());
  });

  it('resolves valid: false for an expired/unknown token', async () => {
    server.use(
      http.get('*/api/auth/reset-password/validate', () =>
        HttpResponse.json(buildValidateResetTokenResponse({ valid: false })),
      ),
    );

    const { result } = renderHook(() => useValidateResetToken('reset_expired'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(buildValidateResetTokenResponse({ valid: false }));
  });

  it('surfaces an error state on a network failure', async () => {
    server.use(http.get('*/api/auth/reset-password/validate', () => HttpResponse.error()));

    const { result } = renderHook(() => useValidateResetToken('reset_abc'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('does not fire when the token is null', () => {
    let requestCount = 0;
    server.use(
      http.get('*/api/auth/reset-password/validate', () => {
        requestCount++;
        return HttpResponse.json(buildValidateResetTokenResponse({ valid: false }));
      }),
    );

    const { result } = renderHook(() => useValidateResetToken(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(requestCount).toBe(0);
  });
});
