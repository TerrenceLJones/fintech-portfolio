import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { SignUpError, useSignUp } from './use-sign-up';
import {
  buildSignUpErrorResponse,
  registerMswServer,
} from '@fintech-portfolio/mock-backend/test-factories';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

describe('useSignUp', () => {
  it('resolves on a 200 response', async () => {
    server.use(http.post('*/api/auth/signup', () => HttpResponse.json({})));

    const { result } = renderHook(() => useSignUp(), { wrapper });
    result.current.mutate({ email: 'new-owner@clearline.dev', password: 'Correct-Horse-1!ab' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('throws a SignUpError with code weak_password for a 422 response', async () => {
    server.use(
      http.post('*/api/auth/signup', () =>
        HttpResponse.json(buildSignUpErrorResponse(), { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useSignUp(), { wrapper });
    result.current.mutate({ email: 'weak@clearline.dev', password: 'weak' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(SignUpError);
    expect((result.current.error as SignUpError).code).toBe('weak_password');
  });

  it('throws a plain error on a network failure', async () => {
    server.use(http.post('*/api/auth/signup', () => HttpResponse.error()));

    const { result } = renderHook(() => useSignUp(), { wrapper });
    result.current.mutate({ email: 'new-owner@clearline.dev', password: 'Correct-Horse-1!ab' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).not.toBeInstanceOf(SignUpError);
  });
});
