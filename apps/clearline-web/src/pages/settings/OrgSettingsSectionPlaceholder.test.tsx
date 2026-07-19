import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { OrgSettingsSectionPlaceholder } from './OrgSettingsSectionPlaceholder';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

function renderSection() {
  setAccessToken('access_valid');
  return render(
    withQueryClient(
      <MemoryRouter>
        <OrgSettingsSectionPlaceholder slug="billing" title="Billing & Plan" />
      </MemoryRouter>,
      new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    ),
  );
}

describe('OrgSettingsSectionPlaceholder', () => {
  it('renders the section content when the server authorizes it', async () => {
    server.use(
      http.get('*/api/settings/sections/:slug', ({ params }) =>
        HttpResponse.json({ slug: params.slug, authorized: true }),
      ),
    );
    renderSection();
    expect(await screen.findByRole('heading', { name: 'Billing & Plan' })).toBeInTheDocument();
  });

  it('degrades to AccessDenied when the server independently returns 403 (AC-04 belt-and-suspenders)', async () => {
    server.use(
      http.get('*/api/settings/sections/:slug', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );
    renderSection();

    await waitFor(() => expect(screen.getByText(/Ask an admin/i)).toBeInTheDocument());
    expect(
      screen.getByText('403 Forbidden · GET /api/settings/sections/billing'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Billing & Plan' })).not.toBeInTheDocument();
  });
});
