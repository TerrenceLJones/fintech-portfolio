import { useMemo, useState } from 'react';
import { Alert, Button, Select, TextField, Text } from '@clearline/ui';
import {
  TransferOwnershipError,
  useTeamRoster,
  useTransferOwnership,
} from '@clearline/data-access-team';
import { useTwoFactorStatus } from '@clearline/data-access-security';
import { CARD } from './card';

/**
 * Settings → Security & Compliance → Transfer ownership (US-CW-043). Owner-only — the parent renders it
 * only when the live session is the Owner (isOwner), and the server independently enforces the same on
 * the transfer endpoint (AC-02). The new Owner is chosen from existing members only, never a free-text
 * email (AC-01); confirming names the specific consequence (§19.9 / AC-03) and requires step-up
 * re-auth — the acting Owner's password plus a TOTP code when they have 2FA enrolled (AC-04). On success
 * the outgoing Owner loses Owner surfaces on the next session refetch, no re-login (AC-06).
 */
export function TransferOwnershipCard({ onToast }: { onToast: (message: string) => void }) {
  const roster = useTeamRoster();
  const twoFactor = useTwoFactorStatus();
  const transfer = useTransferOwnership();

  const [selectedId, setSelectedId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');

  // Eligible targets are every current member who isn't the Owner — that excludes the acting Owner
  // themselves (AC-01). Pending invites are not members yet, so they never appear.
  const eligible = useMemo(
    () => (roster.data?.members ?? []).filter((member) => !member.isOwner),
    [roster.data],
  );
  const selected = eligible.find((member) => member.id === selectedId);
  const needsTotp = twoFactor.data?.enabled ?? false;

  function reset() {
    setConfirming(false);
    setPassword('');
    setTotpCode('');
    transfer.reset();
  }

  function handleSubmit() {
    if (!selected) return;
    transfer.mutate(
      { newOwnerId: selected.id, password, totpCode: needsTotp ? totpCode : undefined },
      {
        onSuccess: () => {
          onToast(`Ownership transferred to ${selected.displayName}. You are now an Admin.`);
          setSelectedId('');
          reset();
        },
      },
    );
  }

  const errorMessage =
    transfer.error instanceof TransferOwnershipError
      ? TRANSFER_ERROR_COPY[transfer.error.code]
      : transfer.isError
        ? 'Something went wrong transferring ownership. Please try again.'
        : undefined;

  return (
    <section className={`${CARD} flex flex-col gap-4`} aria-labelledby="transfer-ownership-heading">
      <div className="flex flex-col gap-1">
        <Text as="h3" id="transfer-ownership-heading" size="label" weight="semibold">
          Transfer ownership
        </Text>
        <Text as="p" tone="muted" size="label">
          Hand the Owner role to another member. You will become an Admin and lose Owner authority.
          This is the only supported way to leave as Owner, and it can&rsquo;t be undone by you.
        </Text>
      </div>

      {eligible.length === 0 ? (
        <Text as="p" tone="muted" size="label">
          You&rsquo;re the only member. Invite someone to your organization before you can transfer
          ownership.
        </Text>
      ) : !confirming ? (
        <div className="flex items-center gap-3">
          <Select
            aria-label="New owner"
            value={selectedId}
            onValueChange={setSelectedId}
            placeholder="Select a member…"
            options={eligible.map((member) => ({
              value: member.id,
              label: `${member.displayName} · ${member.email}`,
            }))}
            className="w-72"
          />
          <Button variant="primary" onClick={() => setConfirming(true)} disabled={!selected}>
            Transfer ownership…
          </Button>
        </div>
      ) : selected ? (
        <div className="border-cl-border-2 flex flex-col gap-4 rounded-lg border p-4">
          <Alert
            tone="warning"
            title={`Transfer ownership to ${selected.displayName}?`}
            message={`${selected.displayName} will become the Owner with full, non-removable control of this organization. You will become an Admin and lose Owner authority. This cannot be undone by you.`}
          />
          <TextField
            label="Your password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            state={errorMessage ? 'error' : 'default'}
          />
          {needsTotp ? (
            <TextField
              label="Authenticator code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              help="Enter the 6-digit code from your authenticator app."
              state={errorMessage ? 'error' : 'default'}
            />
          ) : null}
          {errorMessage ? (
            <Text as="p" role="alert" tone="negative" size="label">
              {errorMessage}
            </Text>
          ) : null}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={transfer.isPending}
              disabled={!password || (needsTotp && !totpCode)}
            >
              Transfer ownership
            </Button>
            <Button variant="ghost" onClick={reset} disabled={transfer.isPending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Named, specific reasons for a rejected transfer (US-CW-043 AC-07) — never a generic failure. */
const TRANSFER_ERROR_COPY: Record<TransferOwnershipError['code'], string> = {
  reauth_failed:
    'That password or authenticator code was incorrect. Ownership was not transferred.',
  not_owner: 'You are no longer the Owner, so you cannot transfer ownership.',
  member_not_found:
    'That member is no longer in your organization. Pick someone else to transfer to.',
  invalid_transfer_target: 'You cannot transfer ownership to yourself.',
};
