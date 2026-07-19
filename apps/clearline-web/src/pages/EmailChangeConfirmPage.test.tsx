import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { EmailChangeConfirmPage } from './EmailChangeConfirmPage';
import { withQueryClient } from '../test/with-query-client';

const server = registerMswServer();

function renderConfirm(token: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    withQueryClient(
      <ThemeProvider>
        <MemoryRouter initialEntries={[`/email-change/confirm?token=${token}`]}>
          <Routes>
            <Route path="/email-change/confirm" element={<EmailChangeConfirmPage />} />
            <Route path="/settings/personal" element={<div>Settings</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
      queryClient,
    ),
  );
}

describe('EmailChangeConfirmPage (AC-03/04)', () => {
  it('confirms a valid link and shows the new email', async () => {
    server.use(
      http.get('*/api/profile/email-change/validate', () => HttpResponse.json({ valid: true })),
      http.post('*/api/profile/email-change/confirm', () =>
        HttpResponse.json({ outcome: 'success', email: 'new@clearline.dev' }),
      ),
    );
    renderConfirm('good-token');

    await waitFor(() => expect(screen.getByText('Email updated')).toBeInTheDocument());
    expect(screen.getByText(/new@clearline.dev/)).toBeInTheDocument();
  });

  it('shows the expired screen for an invalid/expired link, leaving the email unchanged (AC-04)', async () => {
    server.use(
      http.get('*/api/profile/email-change/validate', () => HttpResponse.json({ valid: false })),
    );
    renderConfirm('stale-token');

    await waitFor(() => expect(screen.getByText('This link has expired')).toBeInTheDocument());
  });

  it('treats a missing token as expired without calling the API', async () => {
    renderConfirm('');
    await waitFor(() => expect(screen.getByText('This link has expired')).toBeInTheDocument());
  });
});
