import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useRequestPasswordReset } from './use-request-password-reset';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

describe('useRequestPasswordReset', () => {
  it('resolves on a 200 response', async () => {
    server.use(http.post('*/api/auth/forgot-password', () => HttpResponse.json({})));

    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper });
    result.current.mutate({ email: 'demo@clearline.dev' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('throws on a network failure', async () => {
    server.use(http.post('*/api/auth/forgot-password', () => HttpResponse.error()));

    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper });
    result.current.mutate({ email: 'demo@clearline.dev' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
