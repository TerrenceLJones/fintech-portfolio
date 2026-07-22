import { useState } from 'react';
import { ConfirmationDialog, Icon, Switch, Text } from '@clearline/ui';
import type { OrgSecurityResponse } from '@clearline/contracts';
import { useSetTwoFactorEnforcement } from '@clearline/data-access-org-security';
import { CARD } from './card';

/**
 * Org-wide mandatory 2FA (US-CW-040 AC-03). Turning it ON warns that unenrolled members are prompted to
 * set up 2FA on their next login and cannot access Clearline until they do (AC-04, enforced by the
 * login-flow gate). Immediate save behind the confirmation.
 */
export function TwoFactorEnforcementCard({
  posture,
  onToast,
}: {
  posture: OrgSecurityResponse;
  onToast: (message: string) => void;
}) {
  const setEnforcement = useSetTwoFactorEnforcement();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleToggle(next: boolean) {
    if (next) {
      setConfirmOpen(true);
    } else {
      setEnforcement.mutate(false, { onSuccess: () => onToast('2FA is no longer required') });
    }
  }

  function confirmEnforce() {
    setConfirmOpen(false);
    setEnforcement.mutate(true, {
      onSuccess: () => onToast('2FA is now required for all members'),
    });
  }

  return (
    <section className={`${CARD} flex flex-col gap-4`} aria-labelledby="twofa-heading">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Text as="h3" id="twofa-heading" size="label" weight="semibold">
            Require 2FA for all members
          </Text>
          <Text as="p" tone="muted" size="label">
            Members without two-factor authentication must set it up before they can access
            Clearline.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          {posture.requireTwoFactor ? (
            <span className="text-cl-pos bg-cl-pos-weak inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
              <Icon name="check" size={12} /> Required
            </span>
          ) : null}
          <Switch
            checked={posture.requireTwoFactor}
            onCheckedChange={handleToggle}
            aria-label="Require 2FA for all members"
          />
        </div>
      </div>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Require 2FA for all members?"
        body="Members without 2FA will be prompted to set it up on their next login. They cannot access Clearline until 2FA is configured."
        confirmLabel="Require 2FA"
        countdown={0}
        onConfirm={confirmEnforce}
      />
    </section>
  );
}
