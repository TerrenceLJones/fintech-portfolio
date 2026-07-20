import { useState } from 'react';
import {
  Button,
  ConfirmationDialog,
  Icon,
  PasswordField,
  PasswordRequirementsList,
  Text,
} from '@clearline/ui';
import type { DeviceSession, TrustedDevice } from '@clearline/contracts';
import { evaluateSignUpPassword, isValidSignUpPassword } from '@clearline/domain-auth';
import {
  ChangePasswordError,
  DisableTwoFactorError,
  useChangePassword,
  useDisableTwoFactor,
  useRemoveTrustedDevice,
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
  useTrustedDevices,
  useTwoFactorStatus,
} from '@clearline/data-access-security';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { ToastViewport } from '../../components/ToastViewport';
import { useToast } from '../../hooks/useToast';
import { securityBeacon } from './security.beacon';
import { TotpSetupDialog } from './security/TotpSetupDialog';
import { useTotpSetup } from './security/use-totp-setup';

/** A card surface matching the other settings sections. */
const CARD = 'border-cl-border bg-cl-surface rounded-xl border p-6';

/** Relative "last active" copy (design §19.4). The current session is always "Active now". */
function formatLastActive(iso: string, current: boolean): string {
  if (current) return 'Active now';
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'Active now';
  if (minutes < 60) return `Last active ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Last active ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Last active yesterday';
  return `Last active ${days} days ago`;
}

/** Monitor vs. phone glyph for a session's device type (design §19.4). */
function DeviceIcon({ type }: { type: DeviceSession['deviceType'] }) {
  return type === 'mobile' ? (
    <svg
      width={18}
      height={18}
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <rect x={4.5} y={1.5} width={7} height={13} rx={1.5} />
      <line x1={7} y1={12.5} x2={9} y2={12.5} />
    </svg>
  ) : (
    <svg
      width={18}
      height={18}
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <rect x={1.5} y={3} width={13} height={8.5} rx={1.5} />
      <line x1={5.5} y1={14} x2={10.5} y2={14} />
    </svg>
  );
}

/** New-password strength readout: the shared requirements checklist plus a derived Weak/Fair/Strong label (AC-02). */
function StrengthMeter({ password }: { password: string }) {
  const requirements = evaluateSignUpPassword(password);
  const metCount = Object.values(requirements).filter(Boolean).length;
  const label = metCount >= 4 ? 'Strong' : metCount >= 2 ? 'Fair' : 'Weak';
  const tone = metCount >= 4 ? 'text-cl-pos' : metCount >= 2 ? 'text-cl-warn' : 'text-cl-neg';
  return (
    <div className="flex flex-col gap-2">
      <Text as="p" size="label" tone="muted">
        Password strength: <span className={`font-semibold ${tone}`}>{label}</span>
      </Text>
      <PasswordRequirementsList
        items={[
          { label: 'At least 12 characters', met: requirements.minLength },
          { label: 'Upper & lower case', met: requirements.hasUpperAndLower },
          { label: 'A number', met: requirements.hasNumber },
          { label: 'A symbol', met: requirements.hasSymbol },
        ]}
      />
    </div>
  );
}

/**
 * Settings → Security (US-CW-035). Four self-service surfaces — every authenticated user manages their
 * own account, so no permission is required: a password change that never signs you out elsewhere
 * (AC-01/02), guided authenticator-app 2FA with one-time backup codes (AC-03–07), active-session review
 * and revocation with the current session protected (AC-08/09), and trusted-device removal (AC-10).
 * Every security-sensitive success is audited server-side (AC-11).
 */
export function SecurityPage() {
  useDemoBeacon(securityBeacon);
  const { toast, show: showToast } = useToast(4000);

  // --- Password change (AC-01/02) ---
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const currentError =
    changePassword.error instanceof ChangePasswordError &&
    changePassword.error.code === 'incorrect_password'
      ? 'Incorrect password'
      : undefined;
  const strong = isValidSignUpPassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword;
  const confirmError =
    confirmPassword.length > 0 && !passwordsMatch ? "Passwords don't match" : undefined;
  const canUpdatePassword =
    currentPassword.length > 0 && strong && passwordsMatch && !changePassword.isPending;

  function handleUpdatePassword() {
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          showToast('Password updated');
        },
        onError: () => {
          // Wrong current password: clear only that field, preserve the new-password entries (AC-02).
          setCurrentPassword('');
        },
      },
    );
  }

  // --- Two-factor (AC-03–07) ---
  const { data: twoFactor } = useTwoFactorStatus();
  const totp = useTotpSetup();
  const disableTwoFactor = useDisableTwoFactor();
  const [disableOpen, setDisableOpen] = useState(false);

  function handleDisable() {
    setDisableOpen(false);
    disableTwoFactor.mutate(undefined, {
      onSuccess: () => showToast('Two-factor authentication disabled'),
      onError: (error) => {
        if (error instanceof DisableTwoFactorError && error.code === 'org_enforced') {
          showToast('Your organization requires 2FA.');
        }
      },
    });
  }

  // --- Sessions (AC-08/09) ---
  const { data: sessionData } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [sessionToRevoke, setSessionToRevoke] = useState<DeviceSession | null>(null);
  const [revokeOthersOpen, setRevokeOthersOpen] = useState(false);

  const sessions = sessionData?.sessions ?? [];
  const otherSessions = sessions.filter((session) => !session.current);

  function handleRevokeSession() {
    const target = sessionToRevoke;
    setSessionToRevoke(null);
    if (!target) return;
    revokeSession.mutate(target.id, { onSuccess: () => showToast('Device signed out') });
  }

  function handleRevokeOthers() {
    setRevokeOthersOpen(false);
    revokeOthers.mutate(undefined, {
      onSuccess: (result) =>
        showToast(
          `Signed out ${result.revokedCount} other device${result.revokedCount === 1 ? '' : 's'}`,
        ),
    });
  }

  // --- Trusted devices (AC-10) ---
  const { data: trustedData } = useTrustedDevices();
  const removeTrustedDevice = useRemoveTrustedDevice();
  const trustedDevices: TrustedDevice[] = trustedData?.devices ?? [];

  function handleRemoveTrusted(device: TrustedDevice) {
    removeTrustedDevice.mutate(device.id, { onSuccess: () => showToast('Device removed') });
  }

  return (
    <div className="flex flex-col gap-6">
      <Text as="h2" size="heading">
        Security
      </Text>

      {/* Password (AC-01/02) */}
      <section className={`${CARD} flex flex-col gap-4`}>
        <Text as="h3" size="label" weight="semibold">
          Password
        </Text>
        <PasswordField
          label="Current password"
          value={currentPassword}
          state={currentError ? 'error' : 'default'}
          error={currentError}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <PasswordField
          label="New password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        {newPassword.length > 0 ? <StrengthMeter password={newPassword} /> : null}
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          state={confirmError ? 'error' : 'default'}
          error={confirmError}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <div>
          <Button
            variant="primary"
            onClick={handleUpdatePassword}
            loading={changePassword.isPending}
            disabled={!canUpdatePassword}
          >
            Update password
          </Button>
        </div>
      </section>

      {/* Two-factor (AC-03–07) */}
      <section className={`${CARD} flex flex-col gap-4`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Text as="h3" size="label" weight="semibold">
              Two-factor authentication
            </Text>
            <Text as="p" tone="muted" size="label">
              Add a second step at sign-in using an authenticator app.
            </Text>
          </div>
          {twoFactor?.enabled ? (
            <span className="text-cl-pos bg-cl-pos-weak inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
              <Icon name="check" size={12} /> On
            </span>
          ) : null}
        </div>

        {twoFactor?.enabled ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Icon name="fingerprint" size={18} className="text-cl-text-2" />
              <Text as="span" size="label" weight="medium">
                Authenticator app
              </Text>
            </div>
            {twoFactor.orgEnforced ? (
              <Text as="p" tone="muted" size="label" role="note">
                Required by your organization — contact your admin to change this.
              </Text>
            ) : (
              <Button variant="danger" size="sm" onClick={() => setDisableOpen(true)}>
                Disable
              </Button>
            )}
          </div>
        ) : (
          <div>
            <Button variant="primary" onClick={totp.begin} loading={totp.isStarting}>
              Enable authenticator app
            </Button>
          </div>
        )}
      </section>

      {/* Active sessions (AC-08/09) */}
      <section className={`${CARD} flex flex-col gap-4`}>
        <div className="flex items-center justify-between gap-4">
          <Text as="h3" size="label" weight="semibold">
            Active sessions
          </Text>
          {otherSessions.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRevokeOthersOpen(true)}
              loading={revokeOthers.isPending}
            >
              Sign out all other devices
            </Button>
          ) : null}
        </div>

        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="border-cl-border flex items-center gap-4 rounded-lg border p-3"
              data-testid="session-card"
            >
              <div className="bg-cl-inset text-cl-text-2 flex h-9 w-9 items-center justify-center rounded-lg">
                <DeviceIcon type={session.deviceType} />
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <Text as="span" size="label" weight="medium">
                    {session.browser} on {session.os}
                  </Text>
                  {session.current ? (
                    <span className="text-cl-pos bg-cl-pos-weak inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                      <Icon name="check" size={10} /> This device
                    </span>
                  ) : null}
                </div>
                <Text as="span" tone="muted" size="label">
                  {session.city}, {session.country} ·{' '}
                  {formatLastActive(session.lastActiveAt, session.current)}
                </Text>
              </div>
              {session.current ? (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="You're currently using this session — use the main menu to sign out"
                  className="text-cl-text-3 cursor-not-allowed rounded-md px-2.5 py-1.5 text-sm"
                >
                  Sign out this device
                </button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setSessionToRevoke(session)}>
                  Sign out this device
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Trusted devices (AC-10) */}
      <section className={`${CARD} flex flex-col gap-4`}>
        <div className="flex flex-col gap-1">
          <Text as="h3" size="label" weight="semibold">
            Trusted devices
          </Text>
          <Text as="p" tone="muted" size="label">
            Devices you chose to remember skip the 2FA step at sign-in. Remove one to require 2FA
            there again.
          </Text>
        </div>

        {trustedDevices.length === 0 ? (
          <Text as="p" tone="faint" size="label">
            No trusted devices.
          </Text>
        ) : (
          <ul className="flex flex-col gap-3">
            {trustedDevices.map((device) => (
              <li
                key={device.id}
                className="border-cl-border flex items-center justify-between gap-4 rounded-lg border p-3"
                data-testid="trusted-device"
              >
                <Text as="span" size="label" weight="medium">
                  {device.label}
                </Text>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveTrusted(device)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TotpSetupDialog
        controller={totp}
        onDone={() => showToast('Two-factor authentication enabled')}
      />

      <ConfirmationDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Disable two-factor authentication?"
        body="Your account will be less secure. You can re-enable it any time."
        confirmLabel="Disable 2FA"
        onConfirm={handleDisable}
        countdown={0}
      />

      <ConfirmationDialog
        open={sessionToRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setSessionToRevoke(null);
        }}
        title={
          sessionToRevoke ? `Sign out ${sessionToRevoke.browser} on ${sessionToRevoke.city}?` : ''
        }
        body="That device will need to sign in again. This can't be undone."
        confirmLabel="Sign out"
        onConfirm={handleRevokeSession}
        countdown={0}
      />

      <ConfirmationDialog
        open={revokeOthersOpen}
        onOpenChange={setRevokeOthersOpen}
        title={`This will sign out ${otherSessions.length} other device${otherSessions.length === 1 ? '' : 's'}.`}
        body="You'll stay signed in here. Those devices will need to sign in again."
        confirmLabel="Sign out other devices"
        onConfirm={handleRevokeOthers}
        countdown={0}
      />

      <ToastViewport toast={toast} />
    </div>
  );
}
