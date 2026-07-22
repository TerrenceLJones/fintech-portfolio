import { useState } from 'react';
import { Alert, Button, ConfirmationDialog, Icon, TextField, Text } from '@clearline/ui';
import type { OrgSecurityResponse } from '@clearline/contracts';
import { isIpAllowed, isValidCidr, wouldLockOut } from '@clearline/domain-org-security';
import {
  OrgSecurityActionError,
  useAddIpRange,
  useRemoveIpRange,
} from '@clearline/data-access-org-security';
import { CARD } from './card';

/**
 * IP allowlist (US-CW-040 AC-06/07/08). CIDR ranges restrict which IPs may access Clearline; an empty
 * list allows all. A save that would exclude the acting admin's own current IP is blocked with the IP
 * named — the self-lockout guard — pre-flighted client-side and independently enforced by the server.
 * Removal is confirmed and names the specific range (§19.9).
 */
export function IpAllowlistCard({
  posture,
  onToast,
}: {
  posture: OrgSecurityResponse;
  onToast: (message: string) => void;
}) {
  const addRange = useAddIpRange();
  const removeRange = useRemoveIpRange();
  const { ipAllowlist, currentIp } = posture;

  const [cidr, setCidr] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [ipTest, setIpTest] = useState<boolean | null>(null);

  const trimmed = cidr.trim();
  const validCidr = isValidCidr(trimmed);
  // Pre-flight the self-lockout guard so the warning shows before the admin even clicks Add (AC-07).
  const locksOut = validCidr && wouldLockOut(currentIp, [...ipAllowlist, trimmed]);
  const canAdd = validCidr && !locksOut && !ipAllowlist.includes(trimmed) && !addRange.isPending;

  const serverError = addRange.error instanceof OrgSecurityActionError ? addRange.error : undefined;

  function handleAdd() {
    if (!canAdd) return;
    addRange.mutate(trimmed, {
      onSuccess: () => {
        setCidr('');
        onToast(`Added ${trimmed} to the IP allowlist`);
      },
    });
  }

  function confirmRemove() {
    const range = removing;
    setRemoving(null);
    if (!range) return;
    removeRange.mutate(range, { onSuccess: () => onToast(`Removed ${range}`) });
  }

  return (
    <section className={`${CARD} flex flex-col gap-4`} aria-labelledby="allowlist-heading">
      <div className="flex flex-col gap-1">
        <Text as="h3" id="allowlist-heading" size="label" weight="semibold">
          IP allowlist
        </Text>
        <Text as="p" tone="muted" size="label">
          Restrict access to specific IP ranges. Leave empty to allow all IPs. Your current IP is{' '}
          <span className="font-mono">{currentIp}</span>.
        </Text>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-1">
          <TextField
            aria-label="CIDR range"
            value={cidr}
            placeholder="203.0.113.0/24"
            state={trimmed.length > 0 && !validCidr ? 'error' : 'default'}
            error={trimmed.length > 0 && !validCidr ? 'Enter a valid CIDR range' : undefined}
            onChange={(event) => setCidr(event.target.value)}
          />
        </div>
        <Button variant="secondary" onClick={handleAdd} disabled={!canAdd}>
          Add
        </Button>
      </div>

      {locksOut ? (
        <Alert
          tone="negative"
          title="This would lock you out"
          message={`Your current IP address (${currentIp}) is not in any allowlisted range. Saving this would lock you out of Clearline. Add your IP before saving.`}
        />
      ) : null}
      {serverError?.code === 'self_lockout' ? (
        <Alert
          tone="negative"
          title="This would lock you out"
          message={`Your current IP address (${serverError.detail ?? currentIp}) is not in any allowlisted range. Add your IP before saving.`}
        />
      ) : null}

      {ipAllowlist.length === 0 ? (
        <Text as="p" tone="faint" size="label">
          No ranges — all IPs are currently allowed.
        </Text>
      ) : (
        <ul className="flex flex-col gap-2">
          {ipAllowlist.map((range) => (
            <li
              key={range}
              className="border-cl-border flex items-center justify-between gap-4 rounded-lg border p-3"
              data-testid="ip-range"
            >
              <Text as="span" size="label" weight="medium" className="font-mono">
                {range}
              </Text>
              <Button variant="ghost" size="sm" onClick={() => setRemoving(range)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIpTest(isIpAllowed(currentIp, ipAllowlist))}
        >
          Test my current IP
        </Button>
        {ipTest !== null ? (
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              ipTest ? 'text-cl-pos' : 'text-cl-neg'
            }`}
            role="status"
          >
            <Icon name={ipTest ? 'check' : 'triangle-alert'} size={12} />
            {ipTest ? `${currentIp} is allowed` : `${currentIp} is not in any allowlisted range`}
          </span>
        ) : null}
      </div>

      <ConfirmationDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={removing ? `Remove ${removing} from the IP allowlist?` : 'Remove range?'}
        body="Members previously excluded by this range will be able to access Clearline from those IPs again."
        confirmLabel="Remove"
        countdown={0}
        onConfirm={confirmRemove}
      />
    </section>
  );
}
