import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import type { OrgSecurityResponse } from '@clearline/contracts';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { SecurityCompliancePage } from './SecurityCompliancePage';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const CURRENT_IP = '203.0.113.42';

function posture(overrides: Partial<OrgSecurityResponse> = {}): OrgSecurityResponse {
  return {
    sso: {
      metadataUrl: null,
      entityId: null,
      certificateFingerprint: null,
      lastTest: null,
      enabled: false,
    },
    requireTwoFactor: false,
    idleTimeoutMinutes: 15,
    ipAllowlist: [],
    currentIp: CURRENT_IP,
    ...overrides,
  };
}

function mockBackend({
  authorized = true,
  data = posture(),
}: { authorized?: boolean; data?: OrgSecurityResponse } = {}) {
  setAccessToken('access_valid');
  server.use(
    http.get('*/api/org-security', () =>
      authorized
        ? HttpResponse.json(data)
        : HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
    ),
  );
}

function renderPage() {
  render(
    <ThemeProvider>
      <MemoryRouter>{withQueryClient(<SecurityCompliancePage />)}</MemoryRouter>
    </ThemeProvider>,
  );
}

describe('SecurityCompliancePage', () => {
  it('degrades to AccessDenied on an independent 403 (AC-09)', async () => {
    mockBackend({ authorized: false });
    renderPage();
    await waitFor(() => expect(screen.getByText(/403 Forbidden/)).toBeInTheDocument());
  });

  it('keeps SSO Enable inert until a connection test passes (AC-01/02)', async () => {
    mockBackend();
    renderPage();
    const toggle = await screen.findByRole('switch', { name: 'Enable SSO' });
    expect(toggle).toBeDisabled();
    expect(screen.getByText(/Run a passing connection test to enable SSO/)).toBeInTheDocument();
  });

  it('warns before enabling SSO once a test has passed (AC-02)', async () => {
    mockBackend({
      data: posture({
        sso: {
          metadataUrl: 'https://idp/x',
          entityId: 'urn:x',
          certificateFingerprint: 'abcd1234',
          lastTest: { result: 'passed', reason: null },
          enabled: false,
        },
      }),
    });
    renderPage();
    const toggle = await screen.findByRole('switch', { name: 'Enable SSO' });
    expect(toggle).not.toBeDisabled();
    await userEvent.click(toggle);
    expect(
      await screen.findByText(
        /Password-based login will be disabled for all members except emergency admin/,
      ),
    ).toBeInTheDocument();
  });

  it('confirms before enforcing org-wide 2FA (AC-03)', async () => {
    mockBackend();
    renderPage();
    const toggle = await screen.findByRole('switch', { name: 'Require 2FA for all members' });
    await userEvent.click(toggle);
    expect(
      await screen.findByText(/They cannot access Clearline until 2FA is configured/),
    ).toBeInTheDocument();
  });

  it('blocks an IP range that would lock out the acting admin, naming the IP (AC-07)', async () => {
    mockBackend();
    renderPage();
    const input = await screen.findByLabelText('CIDR range');
    await userEvent.type(input, '198.51.100.0/24');
    expect(
      await screen.findByText(
        new RegExp(`Your current IP address \\(${CURRENT_IP.replace('.', '\\.')}`),
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('names the specific range in the remove confirmation (AC-08)', async () => {
    mockBackend({ data: posture({ ipAllowlist: ['203.0.113.0/24'] }) });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(
      await screen.findByText('Remove 203.0.113.0/24 from the IP allowlist?'),
    ).toBeInTheDocument();
  });
});
