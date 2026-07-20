import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { DeviceSession, TrustedDevice } from '@clearline/contracts';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { AppChrome } from '../../AppChrome';
import { settingsRoutes } from './settings-routes';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const SESSIONS: DeviceSession[] = [
  {
    id: 'session_current',
    deviceType: 'desktop',
    browser: 'Chrome',
    os: 'macOS',
    city: 'San Francisco',
    country: 'US',
    lastActiveAt: new Date().toISOString(),
    current: true,
  },
  {
    id: 'session_firefox',
    deviceType: 'desktop',
    browser: 'Firefox',
    os: 'Windows',
    city: 'New York',
    country: 'US',
    lastActiveAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    current: false,
  },
];

const TRUSTED: TrustedDevice[] = [
  {
    id: 'trusted_macbook',
    label: 'Chrome on macOS · San Francisco',
    trustedAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    lastUsedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
];

function mockSecurityBackend(options?: { enabled?: boolean; orgEnforced?: boolean }) {
  setAccessToken('access_valid');
  const state = {
    twoFactor: { enabled: options?.enabled ?? false, orgEnforced: options?.orgEnforced ?? false },
    sessions: SESSIONS.map((s) => ({ ...s })),
    trusted: TRUSTED.map((d) => ({ ...d })),
  };
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        userId: 'user_1',
        email: 'demo@clearline.dev',
        displayName: 'Marcus Okafor',
        role: 'finance_manager',
        approvalLimit: 1_000_000,
        currency: 'USD',
        isAdmin: false,
        isOwner: false,
        avatarUrl: null,
      }),
    ),
    http.post('*/api/security/password', async ({ request }) => {
      const { currentPassword } = (await request.json()) as { currentPassword: string };
      if (currentPassword !== 'Correct-Horse-Battery-1') {
        return HttpResponse.json({ error: 'incorrect_password' }, { status: 422 });
      }
      return HttpResponse.json({ ok: true });
    }),
    http.get('*/api/security/two-factor', () =>
      HttpResponse.json({
        enabled: state.twoFactor.enabled,
        orgEnforced: state.twoFactor.orgEnforced,
      }),
    ),
    http.post('*/api/security/two-factor/setup', () =>
      HttpResponse.json({
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUri:
          'otpauth://totp/Clearline:demo@clearline.dev?secret=JBSWY3DPEHPK3PXP&issuer=Clearline',
      }),
    ),
    http.post('*/api/security/two-factor/verify', async ({ request }) => {
      const { code } = (await request.json()) as { code: string };
      if (code !== '123456') return HttpResponse.json({ error: 'incorrect_code' }, { status: 422 });
      state.twoFactor.enabled = true;
      return HttpResponse.json({
        backupCodes: Array.from({ length: 10 }, (_, i) => `aaaa-${String(1000 + i)}`),
      });
    }),
    http.post('*/api/security/two-factor/disable', () => {
      if (state.twoFactor.orgEnforced)
        return HttpResponse.json({ error: 'org_enforced' }, { status: 403 });
      state.twoFactor.enabled = false;
      return HttpResponse.json({ ok: true });
    }),
    http.get('*/api/security/sessions', () => HttpResponse.json({ sessions: state.sessions })),
    http.delete('*/api/security/sessions/:id', ({ params }) => {
      state.sessions = state.sessions.filter((s) => s.id !== params.id);
      return HttpResponse.json({ ok: true });
    }),
    http.post('*/api/security/sessions/revoke-others', () => {
      const revokedCount = state.sessions.filter((s) => !s.current).length;
      state.sessions = state.sessions.filter((s) => s.current);
      return HttpResponse.json({ revokedCount });
    }),
    http.get('*/api/security/trusted-devices', () => HttpResponse.json({ devices: state.trusted })),
    http.delete('*/api/security/trusted-devices/:id', ({ params }) => {
      state.trusted = state.trusted.filter((d) => d.id !== params.id);
      return HttpResponse.json({ ok: true });
    }),
  );
  return state;
}

function renderSecurity() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    withQueryClient(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/settings/security']}>
          <Routes>
            <Route element={<AppChrome />}>{settingsRoutes()}</Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
      queryClient,
    ),
  );
}

const STRONG = 'Str0ng-Pass!word';

describe('SecurityPage — password change (AC-01/02)', () => {
  it('updates the password and clears the fields on success', async () => {
    mockSecurityBackend();
    const user = userEvent.setup();
    renderSecurity();

    await user.type(await screen.findByLabelText('Current password'), 'Correct-Horse-Battery-1');
    await user.type(screen.getByLabelText('New password'), STRONG);
    await user.type(screen.getByLabelText('Confirm new password'), STRONG);
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Password updated')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });

  it('keeps the update button disabled until the new password is strong and matches', async () => {
    mockSecurityBackend();
    const user = userEvent.setup();
    renderSecurity();

    await user.type(await screen.findByLabelText('Current password'), 'Correct-Horse-Battery-1');
    await user.type(screen.getByLabelText('New password'), 'weak');
    // Button uses a soft (aria) disable so it stays screen-reader reachable with a reason.
    expect(screen.getByRole('button', { name: 'Update password' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await user.clear(screen.getByLabelText('New password'));
    await user.type(screen.getByLabelText('New password'), STRONG);
    await user.type(screen.getByLabelText('Confirm new password'), 'different');
    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update password' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('shows "Incorrect password", clears the current field, and preserves the new password (AC-02)', async () => {
    mockSecurityBackend();
    const user = userEvent.setup();
    renderSecurity();

    await user.type(await screen.findByLabelText('Current password'), 'wrong-password');
    await user.type(screen.getByLabelText('New password'), STRONG);
    await user.type(screen.getByLabelText('Confirm new password'), STRONG);
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Incorrect password')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('New password')).toHaveValue(STRONG);
  });
});

describe('SecurityPage — two-factor setup (AC-03/04/05/06)', () => {
  it('walks generate → verify → complete and shows backup codes once', async () => {
    mockSecurityBackend();
    const user = userEvent.setup();
    renderSecurity();

    await user.click(await screen.findByRole('button', { name: 'Enable authenticator app' }));

    // Step 1 — client-rendered QR + manual secret (AC-03).
    expect(await screen.findByRole('heading', { name: 'Scan the QR code' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /can't scan a QR code/i }));
    expect(screen.getByTestId('totp-manual-secret')).toHaveTextContent('JBSW');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2 — a wrong code keeps us here (AC-05). Entry auto-submits on the sixth digit.
    expect(
      await screen.findByRole('heading', { name: 'Enter the 6-digit code' }),
    ).toBeInTheDocument();
    const otpCells = () => screen.getAllByLabelText(/digit 1$/);
    await user.click(otpCells()[0]!);
    await user.keyboard('000000');
    expect(await screen.findByText(/Incorrect code/)).toBeInTheDocument();

    // A correct code completes setup and reveals the ten backup codes (AC-04).
    await user.click(otpCells()[0]!);
    await user.keyboard('123456');
    await waitFor(() => expect(screen.getByTestId('backup-codes')).toBeInTheDocument());
    expect(within(screen.getByTestId('backup-codes')).getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText(/won't be shown again/)).toBeInTheDocument();

    // Done closes the flow; 2FA now reads as enabled, with no way to re-view the codes (AC-06).
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Two-factor authentication enabled')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Show backup codes/i)).not.toBeInTheDocument();
  });
});

describe('SecurityPage — 2FA disable & org enforcement (AC-07)', () => {
  it('shows a Disable control when 2FA is enabled and the org does not enforce it', async () => {
    mockSecurityBackend({ enabled: true });
    renderSecurity();
    expect(await screen.findByRole('button', { name: 'Disable' })).toBeInTheDocument();
  });

  it('replaces Disable with the admin-contact message when the org enforces 2FA', async () => {
    mockSecurityBackend({ enabled: true, orgEnforced: true });
    renderSecurity();
    expect(
      await screen.findByText(/Required by your organization — contact your admin/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
  });
});

describe('SecurityPage — active sessions (AC-08/09)', () => {
  it('badges the current device and disables its sign-out', async () => {
    mockSecurityBackend();
    renderSecurity();
    const cards = await screen.findAllByTestId('session-card');
    const current = cards.find((c) => within(c).queryByText('This device'));
    expect(current).toBeDefined();
    expect(within(current!).getByRole('button', { name: 'Sign out this device' })).toBeDisabled();
  });

  it('signs out another device after confirmation (AC-09)', async () => {
    mockSecurityBackend();
    const user = userEvent.setup();
    renderSecurity();

    const cards = await screen.findAllByTestId('session-card');
    const other = cards.find((c) => within(c).queryByText(/Firefox on Windows/))!;
    await user.click(within(other).getByRole('button', { name: 'Sign out this device' }));

    expect(
      await screen.findByRole('heading', { name: 'Sign out Firefox on New York?' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('Device signed out')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Firefox on Windows/)).not.toBeInTheDocument());
  });
});

describe('SecurityPage — trusted devices (AC-10)', () => {
  it('removes a trusted device', async () => {
    mockSecurityBackend();
    const user = userEvent.setup();
    renderSecurity();

    const device = await screen.findByTestId('trusted-device');
    await user.click(within(device).getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText('Device removed')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('trusted-device')).not.toBeInTheDocument());
  });
});
