import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { QueryClient } from '@tanstack/react-query';
import type { CreateApiKeyResponse, DeveloperResponse, WebhookSummary } from '@clearline/contracts';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { DeveloperSettingsPage } from './DeveloperSettingsPage';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const FAILED_WEBHOOK: WebhookSummary = {
  id: 'webhook_1',
  url: 'https://api.acme.co/hooks',
  events: ['transfer.completed', 'card.transaction.declined'],
  status: 'active',
  maskedSigningSecret: 'whsec_••••••••••••••ab3f',
  createdAt: '2026-06-01T10:05:00.000Z',
  deliveries: [
    {
      id: 'whd_1',
      eventType: 'card.transaction.declined',
      httpStatus: 503,
      deliveredAt: '2026-07-15T07:30:11.000Z',
      durationMs: 30000,
      ok: false,
    },
  ],
};

function mockGet(data: DeveloperResponse | 'forbidden') {
  setAccessToken('access_valid');
  server.use(
    http.get('*/api/developer', () =>
      data === 'forbidden'
        ? HttpResponse.json({ error: 'forbidden_role' }, { status: 403 })
        : HttpResponse.json(data),
    ),
  );
}

function renderPage() {
  render(
    <ThemeProvider>
      <MemoryRouter>
        {withQueryClient(
          <DeveloperSettingsPage />,
          new QueryClient({ defaultOptions: { queries: { retry: false } } }),
        )}
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('DeveloperSettingsPage', () => {
  it('degrades to AccessDenied on an independent 403 (AC-10)', async () => {
    mockGet('forbidden');
    renderPage();
    await waitFor(() => expect(screen.getByText(/403 Forbidden/)).toBeInTheDocument());
  });

  it('shows the empty state with a Create CTA when there are no keys (AC-05)', async () => {
    mockGet({ apiKeys: [], webhooks: [] });
    renderPage();
    expect(
      await screen.findByText(/No API keys yet\. Create a key to access the Clearline API/),
    ).toBeInTheDocument();
  });

  it('creates a key, reveals it once, then shows only the masked form (AC-01/02)', async () => {
    let created = false;
    setAccessToken('access_valid');
    const createResponse: CreateApiKeyResponse = {
      key: {
        id: 'apikey_1',
        name: 'Prod',
        maskedKey: 'sk_live_••••••••••••••ab3f',
        scopes: ['read:transactions'],
        createdAt: '2026-07-22T00:00:00.000Z',
        lastUsedAt: null,
      },
      plaintextKey: 'sk_live_FULLSECRETVALUEab3f',
    };
    server.use(
      http.get('*/api/developer', () =>
        HttpResponse.json<DeveloperResponse>({
          apiKeys: created ? [createResponse.key] : [],
          webhooks: [],
        }),
      ),
      http.post('*/api/developer/api-keys', () => {
        created = true;
        return HttpResponse.json(createResponse, { status: 201 });
      }),
    );
    renderPage();

    await userEvent.click((await screen.findAllByRole('button', { name: 'Create new key' }))[0]!);
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Key name'), 'Prod');
    await userEvent.click(dialog.getByLabelText('Read transactions'));
    await userEvent.click(dialog.getByRole('button', { name: 'Create' }));

    // The full key is revealed exactly once.
    expect(await screen.findByText('sk_live_FULLSECRETVALUEab3f')).toBeInTheDocument();

    // Dismiss the reveal — only the masked form remains, and the plaintext is gone.
    await userEvent.click(screen.getByRole('button', { name: /I've copied it — done/ }));
    expect(await screen.findByText('sk_live_••••••••••••••ab3f')).toBeInTheDocument();
    expect(screen.queryByText('sk_live_FULLSECRETVALUEab3f')).not.toBeInTheDocument();
  });

  it('names the specific key in the revoke confirmation (AC-04)', async () => {
    mockGet({
      apiKeys: [
        {
          id: 'apikey_1',
          name: 'Production — Read Only',
          maskedKey: 'sk_live_••••••••••••••ab3f',
          scopes: ['read:transactions'],
          createdAt: '2026-06-01T10:00:00.000Z',
          lastUsedAt: null,
        },
      ],
      webhooks: [],
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    expect(await screen.findByText('Revoke "Production — Read Only"?')).toBeInTheDocument();
  });

  it('blocks a non-HTTPS webhook URL with an inline error (AC-07)', async () => {
    mockGet({ apiKeys: [], webhooks: [] });
    renderPage();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Add endpoint' }))[0]!);
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Endpoint URL'), 'http://api.acme.co/hooks');
    expect(await screen.findByText('Webhook endpoints must use HTTPS.')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows a failed delivery with a status badge, Resend, retry schedule, and HMAC reference (AC-08/09)', async () => {
    mockGet({ apiKeys: [], webhooks: [FAILED_WEBHOOK] });
    renderPage();
    expect(await screen.findByText('503')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend' })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Clearline retries failed deliveries at 1m, 5m, 30m, 2h, and 8h intervals\./,
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /Verify the Clearline-Signature header/ }),
    );
    expect(
      await screen.findByText(/createHmac\('sha256', WEBHOOK_SIGNING_SECRET\)/),
    ).toBeInTheDocument();
  });
});
