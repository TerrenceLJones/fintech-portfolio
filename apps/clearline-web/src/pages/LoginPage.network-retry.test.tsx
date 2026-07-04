import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { LoginPage } from './LoginPage';
import { useLogin } from '@fintech-portfolio/data-access-auth';
import { withQueryClient } from '../test/with-query-client';
import { buildMutationResult } from '../test/build-mutation-result';

// The retry/backoff mechanics themselves are already covered by libs/data-access/auth's
// use-login.test.tsx with an injected near-zero delay; this file mocks the hook entirely so the
// exhausted-retries UI state can be tested without a ~14s real-backoff wait. Kept in its own
// file because vi.mock hoists to the top of the whole module — mixing it into LoginPage.test.tsx
// would silently break that file's real-MSW-backed tests too.
vi.mock('@fintech-portfolio/data-access-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fintech-portfolio/data-access-auth')>();
  return { ...actual, useLogin: vi.fn() };
});

function renderLoginPage() {
  return render(
    withQueryClient(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Dashboard stub</div>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}

describe('LoginPage — network error exhausted retries (AC-05)', () => {
  it('shows a manual "Try again" button once retries are exhausted, and it re-submits', async () => {
    const mutate = vi.fn();
    vi.mocked(useLogin).mockReturnValue(
      buildMutationResult({
        mutate,
        isError: true,
        error: new Error('network_error'),
      }) as unknown as ReturnType<typeof useLogin>,
    );

    renderLoginPage();
    const user = userEvent.setup();
    const tryAgainButton = await screen.findByRole('button', { name: 'Try again' });
    await user.click(tryAgainButton);

    expect(mutate).toHaveBeenCalled();
  });
});

describe('LoginPage — does not resubmit while a login request is already pending', () => {
  it('does not call mutate again if the Sign in button is clicked while isPending is true', async () => {
    const mutate = vi.fn();
    vi.mocked(useLogin).mockReturnValue(
      buildMutationResult({ mutate, isPending: true }) as unknown as ReturnType<typeof useLogin>,
    );

    renderLoginPage();
    const user = userEvent.setup();
    const signInButton = screen.getByRole('button', { name: 'Sign in' });

    // Sign in is a type="submit" button rendered via the shared Button component, which stays
    // enabled while loading (for a11y — see Button.tsx). It must still block the click from
    // resubmitting the enclosing form, or an impatient extra click/Enter press during a pending
    // request would fire a second login attempt (skewing the AC-04 lockout counter and racing
    // the AC-05 retry/backoff flow).
    expect(signInButton).not.toBeDisabled();
    await user.click(signInButton);

    expect(mutate).not.toHaveBeenCalled();
  });
});
